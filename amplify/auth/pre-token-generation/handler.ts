import type { PreTokenGenerationTriggerHandler } from 'aws-lambda';
import { env } from '$amplify/env/pre-token-generation';

export const handler: PreTokenGenerationTriggerHandler = async (event) => {
  const email = event.request.userAttributes.email ?? '';
  const domain = email.split('@')[1]?.toLowerCase();

  if (domain !== env.ALLOWED_EMAIL_DOMAIN.toLowerCase()) {
    throw new Error(
      `Access restricted to ${env.ALLOWED_EMAIL_DOMAIN} Google Workspace accounts.`,
    );
  }

  return event;
};
