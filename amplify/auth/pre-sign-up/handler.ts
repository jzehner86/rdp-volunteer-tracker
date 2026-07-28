import type { PreSignUpTriggerHandler } from 'aws-lambda';
import { env } from '$amplify/env/pre-sign-up';

export const handler: PreSignUpTriggerHandler = async (event) => {
  // `email: true` is enabled on the User Pool only because Cognito requires
  // at least one local login mechanism alongside externalProviders — direct
  // (non-federated) sign-up is never intended to work. Reject it outright so
  // nobody can self-register an email/password account, even one that
  // happens to match the allowed domain.
  if (event.triggerSource !== 'PreSignUp_ExternalProvider') {
    throw new Error('Direct sign-up is disabled. Sign in with Google instead.');
  }

  const email = event.request.userAttributes.email ?? '';
  const domain = email.split('@')[1]?.toLowerCase();

  if (domain !== env.ALLOWED_EMAIL_DOMAIN.toLowerCase()) {
    throw new Error(
      `Access restricted to ${env.ALLOWED_EMAIL_DOMAIN} Google Workspace accounts.`,
    );
  }

  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  return event;
};
