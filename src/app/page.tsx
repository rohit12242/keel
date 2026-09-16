import { getConfig } from "@/config/env";
import type { Day } from "@/shared/contract";
import styles from "./page.module.css";

// Server-rendered per request (D-04), fetched from the real endpoint.
export const dynamic = "force-dynamic";

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

async function fetchDay(date: string): Promise<Day | null> {
  const { appBaseUrl } = getConfig();
  try {
    const res = await fetch(`${appBaseUrl}/day/${date}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Day;
  } catch {
    return null;
  }
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  // "Today" in the server's local zone; ?date= overrides for inspection.
  // Real per-user timezone handling is NFR-12 (v2) / arrives with auth (E-06).
  const day = date ?? new Date().toLocaleDateString("en-CA");
  const data = await fetchDay(day);

  if (!data) {
    // Error state: the endpoint could not be read (e.g. the database is down).
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Today</h1>
        <div className={styles.error} role="alert">
          <strong>Couldn&rsquo;t reach your log.</strong> The day for {day}{" "}
          could not be loaded. Nothing has been lost — try again in a moment.
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Today</h1>
        <p className={styles.date}>{data.date}</p>
        <dl className={styles.totals}>
          <div>
            <dt>Today</dt>
            <dd>{formatMinutes(data.totals.today_minutes)}</dd>
          </div>
          <div>
            <dt>This week</dt>
            <dd>{formatMinutes(data.totals.week_minutes)}</dd>
          </div>
          <div>
            <dt>Extra (off-plan)</dt>
            <dd>{formatMinutes(data.totals.extra_off_day_minutes)}</dd>
          </div>
        </dl>
      </header>

      {data.objectives.length === 0 ? (
        <p className={styles.empty}>No active objectives.</p>
      ) : (
        <ul className={styles.objectives}>
          {data.objectives.map((o) => (
            <li key={o.id} className={styles.objective}>
              <div className={styles.objectiveHead}>
                <h2 className={styles.objectiveTitle}>{o.title}</h2>
                <span className={styles.schedule}>{o.schedule.label}</span>
              </div>
              <p className={styles.plan}>
                {o.slot
                  ? `Planned today: ${formatMinutes(o.slot.target_minutes)}`
                  : "Not scheduled today — anything logged counts as extra."}
                {" · "}
                {formatMinutes(o.logged_minutes)} logged
              </p>

              {o.entries.length > 0 && (
                <ul className={styles.entries}>
                  {o.entries.map((e) => (
                    <li key={e.id} className={styles.entry}>
                      <span className={styles.entryMinutes}>
                        {formatMinutes(e.minutes)}
                      </span>
                      {e.occurred_at_local && (
                        <span className={styles.entryTime}>
                          {e.occurred_at_local}
                        </span>
                      )}
                      <span className={styles.entryNote}>{e.note}</span>
                      {e.extra && <span className={styles.badge}>extra</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
