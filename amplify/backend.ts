import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { calendarSyncFn, calendarSyncScheduledFn } from './functions/calendar-sync/resource';
import { reportsFn } from './functions/reports/resource';

defineBackend({
  auth,
  data,
  calendarSyncFn,
  calendarSyncScheduledFn,
  reportsFn,
});
