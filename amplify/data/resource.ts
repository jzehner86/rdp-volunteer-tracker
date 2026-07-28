import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { calendarSyncFn, calendarSyncScheduledFn } from '../functions/calendar-sync/resource';
import { reportsFn } from '../functions/reports/resource';

const schema = a.schema({
  Event: a
    .model({
      // Set once from the Google Calendar event id and never cleared —
      // this is what lets a removed calendar event still be resolved by
      // title/date for events that already have hours logged against them.
      googleEventId: a.string(),
      title: a.string().required(),
      eventDate: a.date().required(),
      isRemovedFromCalendar: a.boolean().default(false),
      lastSyncedAt: a.datetime(),
      hoursEntries: a.hasMany('HoursEntry', 'eventId'),
    })
    .secondaryIndexes((index) => [index('googleEventId')])
    .authorization((allow) => [allow.authenticated().to(['read'])]),

  HoursEntry: a
    .model({
      eventId: a.id().required(),
      event: a.belongsTo('Event', 'eventId'),
      userEmail: a.string().required(),
      hours: a.float().required(),
      dateWorked: a.date().required(),
      notes: a.string(),
    })
    .secondaryIndexes((index) => [index('eventId')])
    .authorization((allow) => [
      // Each volunteer can only see/manage their own logged hours; the
      // reports function gets separate query-only access at the schema
      // level (below) so raw entries are never broadly readable by
      // other volunteers.
      allow.owner().to(['create', 'read', 'update', 'delete']),
    ]),

  EventTotal: a.customType({
    eventId: a.id().required(),
    title: a.string().required(),
    eventDate: a.date().required(),
    isRemovedFromCalendar: a.boolean().required(),
    totalHours: a.float().required(),
  }),

  ReportsResult: a.customType({
    year: a.integer().required(),
    perEvent: a.ref('EventTotal').array(),
    totalHoursAllUsers: a.float().required(),
  }),

  getReports: a
    .query()
    .arguments({ year: a.integer().required() })
    .returns(a.ref('ReportsResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(reportsFn)),

  CalendarEventSummary: a.customType({
    id: a.id().required(),
    googleEventId: a.string(),
    title: a.string().required(),
    eventDate: a.date().required(),
  }),

  syncCalendarEvents: a
    .mutation()
    .arguments({})
    .returns(a.ref('CalendarEventSummary').array())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(calendarSyncFn)),
})
  // Function access can only be granted at the schema level (not per-model
  // or per-field), so calendar-sync gets read/write across the schema and
  // reports gets query-only — the closest available approximation of the
  // least-privilege split described above.
  .authorization((allow) => [
    allow.resource(calendarSyncFn),
    allow.resource(calendarSyncScheduledFn),
    allow.resource(reportsFn).to(['query']),
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
