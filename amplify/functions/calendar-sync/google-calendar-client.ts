import { google } from 'googleapis';
import { ExternalAccountClient } from 'google-auth-library';

export interface CalendarEvent {
  googleEventId: string;
  title: string;
  eventDate: string; // YYYY-MM-DD
}

const IAM_CREDENTIALS_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Domain-wide delegation without a service account key: Workload Identity
 * Federation (see GOOGLE_WIF_CREDENTIAL_CONFIG) lets this Lambda impersonate
 * the "rdp-calendar-sync" GCP service account using its AWS IAM role — no
 * static credential is ever stored. Impersonating a specific Workspace user
 * (domain-wide delegation) on top of that still requires a signed JWT with a
 * `sub` claim, which normally requires the service account's private key.
 * Since we don't hold that key, we ask Google to sign it for us via the IAM
 * Credentials API's signJwt method, then exchange the signed JWT for a user
 * access token the normal OAuth2 way. See
 * https://jpassing.com/2022/01/15/using-domain-wide-delegation-on-google-cloud-without-service-account-keys/
 */
async function getDelegatedAccessToken(): Promise<string> {
  const credentialConfig = JSON.parse(process.env.GOOGLE_WIF_CREDENTIAL_CONFIG!);
  const impersonatedUser = process.env.GOOGLE_IMPERSONATED_USER!;

  const serviceAccountEmailMatch = String(credentialConfig.service_account_impersonation_url ?? '').match(
    /serviceAccounts\/([^:]+):generateAccessToken/,
  );
  if (!serviceAccountEmailMatch) {
    throw new Error('GOOGLE_WIF_CREDENTIAL_CONFIG is missing a service_account_impersonation_url');
  }
  const serviceAccountEmail = serviceAccountEmailMatch[1];

  const wifClient = ExternalAccountClient.fromJSON({
    ...credentialConfig,
    scopes: [IAM_CREDENTIALS_SCOPE],
  });
  if (!wifClient) {
    throw new Error('Failed to construct an ExternalAccountClient from GOOGLE_WIF_CREDENTIAL_CONFIG');
  }

  // Token #1: this Lambda's AWS role, federated and impersonated as the
  // "rdp-calendar-sync" GCP service account itself (not yet as a Workspace user).
  const { token: serviceAccountToken } = await wifClient.getAccessToken();
  if (!serviceAccountToken) {
    throw new Error('Workload Identity Federation did not return an access token');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: serviceAccountEmail,
    sub: impersonatedUser,
    scope: CALENDAR_READONLY_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  // Token #2: have Google sign a domain-wide-delegation JWT on our behalf —
  // this is the step that substitutes for holding the private key locally.
  const signJwtResponse = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:signJwt`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceAccountToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payload: JSON.stringify(claimSet) }),
    },
  );
  if (!signJwtResponse.ok) {
    throw new Error(`signJwt failed: ${signJwtResponse.status} ${await signJwtResponse.text()}`);
  }
  const { signedJwt } = (await signJwtResponse.json()) as { signedJwt: string };

  // Token #3: exchange the signed JWT for a real access token acting as the
  // impersonated Workspace user, scoped to calendar.readonly.
  const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed: ${tokenResponse.status} ${await tokenResponse.text()}`);
  }
  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token: string };

  return accessToken;
}

/**
 * Reads events off the "RDP Events" calendar. Domain-wide delegation lets
 * this work regardless of which volunteer is signed in — the calendar is
 * read as the impersonated Workspace user, not the caller.
 */
export async function listRdpCalendarEvents(): Promise<CalendarEvent[]> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID!;

  const accessToken = await getDelegatedAccessToken();
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth });

  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const { data } = await calendar.events.list({
      calendarId,
      singleEvents: true,
      orderBy: 'startTime',
      pageToken,
      maxResults: 250,
    });

    for (const event of data.items ?? []) {
      if (!event.id) continue;
      const eventDate = event.start?.date ?? event.start?.dateTime?.slice(0, 10);
      if (!eventDate) continue;

      events.push({
        googleEventId: event.id,
        title: event.summary ?? '(untitled event)',
        eventDate,
      });
    }

    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return events;
}
