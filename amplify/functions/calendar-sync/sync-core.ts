import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource';
import { listRdpCalendarEvents, type CalendarEvent } from './google-calendar-client';

export interface SyncedEventSummary {
  id: string;
  googleEventId: string | null;
  title: string;
  eventDate: string;
}

/**
 * Upserts every live "RDP Events" calendar event into the Event table, then
 * flags (never deletes) any previously-synced Event whose calendar event no
 * longer exists. This is the mechanism that satisfies the retention
 * requirement: an Event row — and any HoursEntry rows against it — survive
 * the source calendar event being deleted.
 */
export async function syncCalendarEvents(env: Parameters<typeof getAmplifyDataClientConfig>[0]): Promise<SyncedEventSummary[]> {
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  const client = generateClient<Schema>({ authMode: 'iam' });

  const liveEvents = await listRdpCalendarEvents();
  const liveIds = new Set(liveEvents.map((e) => e.googleEventId));

  const summaries: SyncedEventSummary[] = [];

  for (const liveEvent of liveEvents) {
    summaries.push(await upsertEvent(client, liveEvent));
  }

  await reconcileRemovedEvents(client, liveIds);

  return summaries;
}

async function upsertEvent(
  client: ReturnType<typeof generateClient<Schema>>,
  liveEvent: CalendarEvent,
): Promise<SyncedEventSummary> {
  const { data: existing } = await client.models.Event.listEventByGoogleEventId({
    googleEventId: liveEvent.googleEventId,
  });

  const now = new Date().toISOString();

  if (existing.length > 0) {
    const current = existing[0];
    const { data: updated } = await client.models.Event.update({
      id: current.id,
      title: liveEvent.title,
      eventDate: liveEvent.eventDate,
      isRemovedFromCalendar: false,
      lastSyncedAt: now,
    });
    return toSummary(updated!);
  }

  const { data: created } = await client.models.Event.create({
    googleEventId: liveEvent.googleEventId,
    title: liveEvent.title,
    eventDate: liveEvent.eventDate,
    isRemovedFromCalendar: false,
    lastSyncedAt: now,
  });
  return toSummary(created!);
}

async function reconcileRemovedEvents(
  client: ReturnType<typeof generateClient<Schema>>,
  liveGoogleEventIds: Set<string>,
): Promise<void> {
  let nextToken: string | null | undefined;

  do {
    const { data: page, nextToken: token } = await client.models.Event.list({
      filter: { isRemovedFromCalendar: { eq: false } },
      nextToken,
    });

    for (const event of page) {
      if (event.googleEventId && !liveGoogleEventIds.has(event.googleEventId)) {
        await client.models.Event.update({
          id: event.id,
          isRemovedFromCalendar: true,
        });
      }
    }

    nextToken = token;
  } while (nextToken);
}

function toSummary(event: { id: string; googleEventId: string | null; title: string; eventDate: string }): SyncedEventSummary {
  return {
    id: event.id,
    googleEventId: event.googleEventId,
    title: event.title,
    eventDate: event.eventDate,
  };
}
