import { defineFunction } from '@aws-amplify/backend';

export const preSignUp = defineFunction({
  name: 'pre-sign-up',
  entry: './handler.ts',
  environment: {
    ALLOWED_EMAIL_DOMAIN: 'rochester-downtown.com',
  },
});
