import type { Schema } from '../../data/resource';
import { env } from '$amplify/env/calendar-sync';
import { syncCalendarEvents } from './sync-core';

export const handler: Schema['syncCalendarEvents']['functionHandler'] = async () => {
  const summaries = await syncCalendarEvents(env);
  return summaries;
};
