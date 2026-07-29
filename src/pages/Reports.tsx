import { useEffect, useState } from 'react';
import { client } from '../lib/data-client';

interface HoursEntryDetail {
  firstName: string;
  lastName: string;
  hours: number;
  dateWorked: string;
  notes: string | null;
}

interface EventTotal {
  eventId: string;
  title: string;
  eventDate: string;
  isRemovedFromCalendar: boolean;
  totalHours: number;
  entries: HoursEntryDetail[];
}

const currentYear = new Date().getFullYear();

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function Reports() {
  const [year, setYear] = useState(currentYear);
  const [perEvent, setPerEvent] = useState<EventTotal[] | null>(null);
  const [totalHoursAllUsers, setTotalHoursAllUsers] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadReport(year);
  }, [year]);

  async function loadReport(reportYear: number) {
    setError(null);
    setPerEvent(null);
    try {
      const { data } = await client.queries.getReports({ year: reportYear });
      const events = (data?.perEvent ?? []).filter((e): e is NonNullable<typeof e> => e !== null);
      setPerEvent(
        events.map((e) => ({
          eventId: e.eventId,
          title: e.title,
          eventDate: e.eventDate,
          isRemovedFromCalendar: e.isRemovedFromCalendar,
          totalHours: e.totalHours,
          entries: (e.entries ?? []).filter((entry): entry is HoursEntryDetail => entry !== null),
        })),
      );
      setTotalHoursAllUsers(data?.totalHoursAllUsers ?? 0);
    } catch (err) {
      console.error(err);
      setError('Could not load the report. Please try again.');
    }
  }

  return (
    <div>
      <div className="reports-toolbar">
        <h2 style={{ marginBottom: 0 }}>Volunteer Hours Report</h2>
        <label>
          Year
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {perEvent === null && !error && (
        <div className="card state-message">
          <p style={{ marginBottom: 0 }}>Loading…</p>
        </div>
      )}

      {perEvent !== null && (
        <>
          <div className="card stat-card">
            <span className="stat-label">Total hours — all volunteers ({year})</span>
            <span className="stat-value">{totalHoursAllUsers}</span>
          </div>

          {perEvent.length === 0 ? (
            <div className="card state-message">
              <p style={{ marginBottom: 0 }}>No hours logged for {year} yet.</p>
            </div>
          ) : (
            <div className="accordion">
              {perEvent.map((row) => (
                <details key={row.eventId} className="card accordion-item">
                  <summary>
                    <span className="event-title">
                      {row.title}
                      {row.isRemovedFromCalendar && <span className="badge">removed from calendar</span>}
                    </span>
                    <span className="event-date">{formatDate(row.eventDate)}</span>
                    <span className="summary-total">{row.totalHours} hrs</span>
                  </summary>
                  <div className="accordion-body">
                    {row.entries.length === 0 ? (
                      <p style={{ margin: 0 }}>No individual entries recorded.</p>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <th>Volunteer</th>
                            <th>Date worked</th>
                            <th>Hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.entries.map((entry, i) => (
                            <tr key={i}>
                              <td>
                                {entry.firstName} {entry.lastName}
                              </td>
                              <td>{formatDate(entry.dateWorked)}</td>
                              <td>
                                {entry.notes ? (
                                  <span className="has-note" tabIndex={0}>
                                    {entry.hours}
                                    <span className="tooltip">{entry.notes}</span>
                                  </span>
                                ) : (
                                  entry.hours
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
