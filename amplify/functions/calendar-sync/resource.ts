import { defineFunction, secret } from '@aws-amplify/backend';

const sharedEnvironment = {
  GOOGLE_CALENDAR_ID: 'c_9d57ac0980721badddb813c979794635261580df3891308fd20aa7cbe18f9bc2@group.calendar.google.com',
  GOOGLE_IMPERSONATED_USER: 'admin@rochester-downtown.com',
};

/**
 * Invoked synchronously (via the syncCalendarEvents mutation) when the Event
 * Picker page loads, so the list is fresh at the moment a volunteer needs it.
 */
export const calendarSyncFn = defineFunction({
  name: 'calendar-sync',
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    ...sharedEnvironment,
    GOOGLE_WIF_CREDENTIAL_CONFIG: secret('GOOGLE_WIF_CREDENTIAL_CONFIG'),
  },
});

/**
 * Daily backstop so calendar-deletion reconciliation (see sync-core.ts)
 * happens even if nobody opens the Event Picker for a while.
 */
export const calendarSyncScheduledFn = defineFunction({
  name: 'calendar-sync-scheduled',
  entry: './scheduled-handler.ts',
  timeoutSeconds: 60,
  schedule: 'every day',
  environment: {
    ...sharedEnvironment,
    GOOGLE_WIF_CREDENTIAL_CONFIG: secret('GOOGLE_WIF_CREDENTIAL_CONFIG'),
  },
});
