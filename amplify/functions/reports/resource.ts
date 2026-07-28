import { defineFunction } from '@aws-amplify/backend';

export const reportsFn = defineFunction({
  name: 'reports',
  entry: './handler.ts',
  timeoutSeconds: 30,
});
