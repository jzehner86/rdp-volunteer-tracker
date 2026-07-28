import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource';
import { env } from '$amplify/env/reports';

export const handler: Schema['getReports']['functionHandler'] = async (event) => {
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  const client = generateClient<Schema>({ authMode: 'iam' });

  const { year } = event.arguments;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const hoursByEvent = new Map<string, number>();
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
    }

    nextToken = token;
  } while (nextToken);

  const perEvent = await Promise.all(
    Array.from(hoursByEvent.entries()).map(async ([eventId, totalHours]) => {
      const { data: eventRecord } = await client.models.Event.get({ id: eventId });
      return {
        eventId,
        title: eventRecord?.title ?? '(deleted event)',
        eventDate: eventRecord?.eventDate ?? '',
        isRemovedFromCalendar: eventRecord?.isRemovedFromCalendar ?? true,
        totalHours,
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
