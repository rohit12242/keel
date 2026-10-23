import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/config/env";
import { isIsoDate } from "@/modules/effort/domain/validateWrite";
import type { Day } from "@/shared/contract";
import { PageHeader } from "../PageHeader";
import { requireUser } from "../requireUser";
import { BrowserDay } from "./BrowserDay";
import styles from "./today.module.css";

export const metadata: Metadata = { title: "Today · Keel" };

// Server-rendered per request (D-04), fetched from the real endpoint.
export const dynamic = "force-dynamic";

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

type Fetched = { day: Day } | "signed_out" | "unreachable";

/**
 * The document request's own cookie goes along, so the server knows who is
 * asking without the browser fetching anything (ADR-002, D-04).
 */
async function fetchDay(date: string): Promise<Fetched> {
  const { appBaseUrl } = getConfig();
  const cookie = (await headers()).get("cookie");
  try {
    const res = await fetch(`${appBaseUrl}/v1/day/${date}`, {
      cache: "no-store",
      headers: cookie ? { cookie } : {},
    });
    if (res.status === 401) return "signed_out";
    if (!res.ok) return "unreachable";
    return { day: (await res.json()) as Day };
  } catch {
    return "unreachable";
  }
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; reset?: string }>;
}) {
  await requireUser();
  const { date, reset } = await searchParams;
  // The day is the browser's (NFR-12): without one, or with anything that
  // is not a date — it goes into the fetch's path — the browser fills it in.
  if (!date || !isIsoDate(date)) {
    return (
      <>
        <PageHeader title="Today" />
        <p className={styles.empty} aria-busy="true">
          Loading your day…
        </p>
        <BrowserDay />
      </>
    );
  }
  const day = date;
  const fetched = await fetchDay(day);

  // The session ended between the frame's check and the fetch.
  if (fetched === "signed_out") redirect("/sign-in");

  if (fetched === "unreachable") {
    // Error state: the endpoint could not be read (e.g. the database is down).
    return (
      <>
        <PageHeader eyebrow={day} title="Today" />
        <div className={styles.error} role="alert">
          <strong>Couldn&rsquo;t reach your log.</strong> The day for {day}{" "}
          could not be loaded. Nothing has been lost — try again in a moment.
        </div>
      </>
    );
  }

  const data = fetched.day;
  return (
    <>
      <PageHeader eyebrow={data.date} title="Today" />
      {reset === "done" ? (
        <p className={styles.notice} role="status">
          Password changed. You&rsquo;re signed in.
        </p>
      ) : null}
      <section className={styles.summary} aria-label="Totals">
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
      </section>

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
    </>
  );
}
