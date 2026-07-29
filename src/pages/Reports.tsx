import { useEffect, useState } from 'react';
import { client } from '../lib/data-client';

interface EventTotal {
  eventId: string;
  title: string;
  eventDate: string;
  isRemovedFromCalendar: boolean;
  totalHours: number;
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
      setPerEvent((data?.perEvent ?? []).filter((e): e is EventTotal => e !== null));
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
            <div className="card table-card">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Total hours</th>
                  </tr>
                </thead>
                <tbody>
                  {perEvent.map((row) => (
                    <tr key={row.eventId}>
                      <td>
                        {row.title}
                        {row.isRemovedFromCalendar && <span className="badge">removed from calendar</span>}
                      </td>
                      <td>{formatDate(row.eventDate)}</td>
                      <td>{row.totalHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
