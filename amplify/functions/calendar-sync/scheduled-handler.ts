import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/calendar-sync-scheduled';
import { syncCalendarEvents } from './sync-core';

export const handler: Handler = async () => {
  const summaries = await syncCalendarEvents(env);
  console.log(`Scheduled calendar sync reconciled ${summaries.length} live event(s).`);
};
