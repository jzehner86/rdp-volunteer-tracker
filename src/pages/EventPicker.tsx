import { useEffect, useState } from 'react';
import type { AuthUser } from 'aws-amplify/auth';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { client } from '../lib/data-client';

interface EventSummary {
  id: string;
  title: string;
  eventDate: string;
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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
      <div className="card state-message">
        <div className="alert alert-error" role="alert" style={{ marginBottom: 0 }}>
          {error}
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void loadEvents()}>
          Retry
        </button>
      </div>
    );
  }

  if (!events) {
    return (
      <div className="card state-message">
        <p style={{ marginBottom: 0 }}>Loading events…</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="card state-message">
        <p style={{ marginBottom: 0 }}>No upcoming RDP Events found.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>RDP Events</h2>
      <ul className="event-list">
        {events.map((event) => (
          <li key={event.id}>
            <span>
              <span className="event-title">{event.title}</span>
              <span className="event-date">{formatDate(event.eventDate)}</span>
            </span>
            <button type="button" className="btn btn-primary" onClick={() => setSelectedEventId(event.id)}>
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
        firstName: attributes.given_name ?? 'Unknown',
        lastName: attributes.family_name ?? 'Volunteer',
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
      <div className="card" style={{ marginTop: 'var(--space-5)' }}>
        <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>
          Logged {hours} hour(s) for {event.title}.
        </div>
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={(e) => void handleSubmit(e)}>
      <h3>Log hours — {event.title}</h3>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
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
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit hours'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onDone} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
