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
      <h2>Volunteer Hours Report</h2>
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

      {error && <p role="alert">{error}</p>}

      {perEvent === null && !error && <p>Loading…</p>}

      {perEvent !== null && (
        <>
          <p>
            <strong>Total hours — all volunteers ({year}):</strong> {totalHoursAllUsers}
          </p>
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
                    {row.isRemovedFromCalendar && ' (removed from calendar)'}
                  </td>
                  <td>{row.eventDate}</td>
                  <td>{row.totalHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
