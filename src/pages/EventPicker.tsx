import { useEffect, useState } from 'react';
import type { AuthUser } from 'aws-amplify/auth';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { client } from '../lib/data-client';

interface EventSummary {
  id: string;
  title: string;
  eventDate: string;
}

export function EventPicker({ user }: { user: AuthUser }) {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    void loadEvents();
  }, []);

  async function loadEvents() {
    setError(null);
    try {
      // Re-syncs from the "RDP Events" Google Calendar into DynamoDB before
      // listing, so the picker is fresh at the moment a volunteer needs it.
      await client.mutations.syncCalendarEvents({});
      const { data } = await client.models.Event.list({
        filter: { isRemovedFromCalendar: { eq: false } },
      });
      setEvents(
        data
          .map((e) => ({ id: e.id, title: e.title, eventDate: e.eventDate }))
          .sort((a, b) => (a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : 0)),
      );
    } catch (err) {
      console.error(err);
      setError('Could not load events. Please try again.');
    }
  }

  if (error) {
    return (
      <div>
        <p role="alert">{error}</p>
        <button type="button" onClick={() => void loadEvents()}>
          Retry
        </button>
      </div>
    );
  }

  if (!events) {
    return <p>Loading events…</p>;
  }

  if (events.length === 0) {
    return <p>No upcoming RDP Events found.</p>;
  }

  return (
    <div>
      <h2>RDP Events</h2>
      <ul className="event-list">
        {events.map((event) => (
          <li key={event.id}>
            <span>
              {event.title} — {event.eventDate}
            </span>
            <button type="button" onClick={() => setSelectedEventId(event.id)}>
              Log hours
            </button>
          </li>
        ))}
      </ul>

      {selectedEventId && (
        <HoursForm
          user={user}
          event={events.find((e) => e.id === selectedEventId)!}
          onDone={() => setSelectedEventId(null)}
        />
      )}
    </div>
  );
}

function HoursForm({
  user,
  event,
  onDone,
}: {
  user: AuthUser;
  event: EventSummary;
  onDone: () => void;
}) {
  const [hours, setHours] = useState('');
  const [dateWorked, setDateWorked] = useState(event.eventDate);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedHours = Number(hours);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      setError('Enter a positive number of hours.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const attributes = await fetchUserAttributes();
      await client.models.HoursEntry.create({
        eventId: event.id,
        userEmail: attributes.email ?? user.username,
        hours: parsedHours,
        dateWorked,
        notes: notes || undefined,
      });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError('Could not log hours. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div>
        <p>Logged {hours} hour(s) for {event.title}.</p>
        <button type="button" onClick={onDone}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <h3>Log hours — {event.title}</h3>
      {error && <p role="alert">{error}</p>}
      <label>
        Hours worked
        <input
          type="number"
          min="0.25"
          step="0.25"
          required
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
      </label>
      <label>
        Date worked
        <input
          type="date"
          required
          value={dateWorked}
          onChange={(e) => setDateWorked(e.target.value)}
        />
      </label>
      <label>
        Notes (optional)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit hours'}
        </button>
        <button type="button" onClick={onDone} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
