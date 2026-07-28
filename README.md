# RDP Volunteer Tracker

Internal webapp for Rochester Downtown (RDP) volunteers to log hours against events
pulled from the "RDP Events" Google Calendar, restricted to `@rochester-downtown.com`
Google Workspace accounts.

Stack: Amplify Gen 2 (Cognito + AppSync/DynamoDB + Lambda) and a React/Vite frontend.

## Local development

```
npm install
npx ampx sandbox     # deploys a personal cloud backend, writes amplify_outputs.json
npm run dev           # in a second terminal
```

## Manual prerequisites (Google Cloud / Workspace admin — outside this repo)

These require Google Cloud project owner / Workspace Super Admin access and cannot be
done from this codebase:

1. Create (or choose) a Google Cloud project under the org for `rochester-downtown.com`.
2. Enable the **Google Calendar API** on that project.
3. Configure the **OAuth consent screen**: User type = **Internal**; scopes `email`,
   `profile`, `openid`.
4. Create an **OAuth 2.0 Client ID** (Web application) for Cognito federation.
   - The authorized redirect URI is `https://<cognito-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`,
     which is only known **after** the first `npx ampx sandbox` deploy produces the
     Cognito Hosted UI domain — deploy once with placeholder secrets, then come back
     and set the real redirect URI, then update the `GOOGLE_CLIENT_ID` /
     `GOOGLE_CLIENT_SECRET` secrets with the real values.
5. Create a **Service Account** for Calendar read access — **no JSON key** (many orgs
   now enforce the `iam.managed.disableServiceAccountKeyCreation` org policy, which
   blocks key downloads outright; even where it's allowed, keyless is preferred).
   Note its numeric **Unique ID** and its email.
6. Authorize **domain-wide delegation** in the Workspace Admin Console (Super Admin
   required): Security → API controls → Domain-wide delegation → add the service
   account's numeric Unique ID → scope `https://www.googleapis.com/auth/calendar.readonly`.
7. Set up **Workload Identity Federation** so the calendar-sync Lambdas can act as that
   service account using their AWS IAM role instead of a static key — enable the IAM
   Service Account Credentials API and Security Token Service API, then create a
   workload identity pool + AWS provider (trusting this AWS account, restricted to the
   calendar-sync Lambda role ARNs), grant those roles `roles/iam.serviceAccountTokenCreator`
   on the service account, and generate the credential config with
   `gcloud iam workload-identity-pools create-cred-config ... --aws --output-file=wif-cred-config.json`.
   This JSON file is **not secret** (no key material — just resource paths) but is
   stored as a secret (`GOOGLE_WIF_CREDENTIAL_CONFIG`) for convenience. See
   `amplify/functions/calendar-sync/google-calendar-client.ts` for how it's used: the
   Lambda gets a token as the service account via WIF, then calls the IAM Credentials
   API's `signJwt` to get a domain-wide-delegation JWT signed *as* the service account
   (substituting for the private key we don't have), then exchanges that for a token
   acting as the impersonated Workspace user.
8. Make sure the workspace user being impersonated (`GOOGLE_IMPERSONATED_USER`) actually
   has access to the "RDP Events" calendar, and record that calendar's Calendar ID
   (Calendar settings → "Integrate calendar") → `GOOGLE_CALENDAR_ID`.

Set the secrets for your sandbox with:

```
npx ampx sandbox secret set GOOGLE_CLIENT_ID
npx ampx sandbox secret set GOOGLE_CLIENT_SECRET
npx ampx sandbox secret set GOOGLE_WIF_CREDENTIAL_CONFIG < wif-cred-config.json
```

`GOOGLE_CALENDAR_ID` and `GOOGLE_IMPERSONATED_USER` are plain (non-secret) environment
variables set directly in `amplify/functions/calendar-sync/resource.ts`.

For a deployed branch (Amplify Hosting), set the equivalent secrets in the Amplify
Console under that branch's secrets.

## Data retention

Calendar events are materialized into the `Event` DynamoDB table on sync (see
`amplify/functions/calendar-sync`). If an event is deleted from Google Calendar, its
`Event` row is flagged `isRemovedFromCalendar: true` rather than deleted, so any
`HoursEntry` rows logged against it — and the Reports page — keep working.
