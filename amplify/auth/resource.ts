import { defineAuth, secret } from '@aws-amplify/backend';
import { preSignUp } from './pre-sign-up/resource';
import { preTokenGeneration } from './pre-token-generation/resource';

/**
 * Amplify/Cognito requires at least one of `email`/`phone` to be enabled
 * alongside `externalProviders` — a bare external-provider-only config
 * fails to deploy ("At least one of email or phone must be enabled").
 * `email: true` here is that required placeholder, NOT an intended login
 * path: the frontend never renders an email/password form, and the
 * preSignUp trigger unconditionally rejects any non-federated ("direct")
 * sign-up, so no email/password account can ever be created. preSignUp
 * and preTokenGeneration additionally reject any account outside the
 * rochester-downtown.com Workspace domain, even for Google sign-ins.
 * @see https://docs.amplify.aws/react/build-a-backend/auth/concepts/external-identity-providers/
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
        attributeMapping: {
          email: 'email',
        },
      },
      callbackUrls: [
        'http://localhost:5173/',
        'https://main.PLACEHOLDER_APP_ID.amplifyapp.com/',
      ],
      logoutUrls: [
        'http://localhost:5173/',
        'https://main.PLACEHOLDER_APP_ID.amplifyapp.com/',
      ],
    },
  },
  triggers: {
    preSignUp,
    preTokenGeneration,
  },
});
