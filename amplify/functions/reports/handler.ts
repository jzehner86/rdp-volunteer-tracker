import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource';
import { env } from '$amplify/env/reports';

interface EntryDetail {
  firstName: string;
  lastName: string;
  hours: number;
  dateWorked: string;
}

export const handler: Schema['getReports']['functionHandler'] = async (event) => {
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  const client = generateClient<Schema>({ authMode: 'iam' });

  const { year } = event.arguments;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const hoursByEvent = new Map<string, number>();
  const entriesByEvent = new Map<string, EntryDetail[]>();
  let totalHoursAllUsers = 0;

  let nextToken: string | null | undefined;
  do {
    const { data: page, nextToken: token } = await client.models.HoursEntry.list({
      filter: { dateWorked: { between: [yearStart, yearEnd] } },
      nextToken,
    });

    for (const entry of page) {
      hoursByEvent.set(entry.eventId, (hoursByEvent.get(entry.eventId) ?? 0) + entry.hours);
      totalHoursAllUsers += entry.hours;

      const entries = entriesByEvent.get(entry.eventId) ?? [];
      entries.push({
        firstName: entry.firstName,
        lastName: entry.lastName,
        hours: entry.hours,
        dateWorked: entry.dateWorked,
      });
      entriesByEvent.set(entry.eventId, entries);
    }

    nextToken = token;
  } while (nextToken);

  const perEvent = await Promise.all(
    Array.from(hoursByEvent.entries()).map(async ([eventId, totalHours]) => {
      const { data: eventRecord } = await client.models.Event.get({ id: eventId });
      const entries = (entriesByEvent.get(eventId) ?? []).sort((a, b) =>
        a.lastName === b.lastName ? a.firstName.localeCompare(b.firstName) : a.lastName.localeCompare(b.lastName),
      );
      return {
        eventId,
        title: eventRecord?.title ?? '(deleted event)',
        eventDate: eventRecord?.eventDate ?? '',
        isRemovedFromCalendar: eventRecord?.isRemovedFromCalendar ?? true,
        totalHours,
        entries,
      };
    }),
  );

  perEvent.sort((a, b) => (a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : 0));

  return {
    year,
    perEvent,
    totalHoursAllUsers,
  };
};
