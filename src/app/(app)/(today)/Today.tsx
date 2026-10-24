"use client";

import Link from "next/link";
import { useState } from "react";
import type { Day, DayObjective } from "@/shared/contract";
import { PlusIcon } from "@/app/icons";
import {
  card,
  entryRows,
  longDate,
  railRow,
  schedulePill,
  summary,
  type EntryRow,
} from "@/modules/today/domain/todayView";
import { PageHeader } from "../PageHeader";
import shell from "../shell.module.css";
import styles from "./today.module.css";

/**
 * Today (03-today.md): the summary, the filter, the objective cards and the
 * rail's Plan to date, drawn from one read of the day. Every word and
 * figure comes from `modules/today/domain/todayView.ts`.
 */
export function Today({ day, reset }: { day: Day; reset: boolean }) {
  const [filter, setFilter] = useState<string>("all");
  const date = day.date;
  const shown = (o: DayObjective) => filter === "all" || filter === o.id;
  const planned = day.objectives.filter(
    (o) => card(o, date).kind === "planned",
  );
  const others = day.objectives.filter((o) => card(o, date).kind === "other");

  return (
    <>
      <PageHeader eyebrow={longDate(date)} title="Today" />
      {reset ? (
        <p className={styles.notice} role="status">
          Password changed. You&rsquo;re signed in.
        </p>
      ) : null}

      {day.objectives.length === 0 ? (
        <EmptyToday />
      ) : (
        <div className={styles.split}>
          <div className={styles.stack}>
            <Summary day={day} />
            <Filter
              objectives={day.objectives}
              value={filter}
              onChange={setFilter}
            />
            {planned.some(shown) ? (
              <div className={styles.grid}>
                {planned.filter(shown).map((o) => (
                  <PlannedCard key={o.id} o={o} date={date} />
                ))}
              </div>
            ) : null}
            {others.some(shown) ? (
              <div className={styles.others}>
                {others.filter(shown).map((o) => (
                  <OtherCard key={o.id} o={o} date={date} />
                ))}
              </div>
            ) : null}
          </div>
          <aside className={styles.rail} aria-label="Plan to date">
            <Adherence objectives={day.objectives} date={date} />
          </aside>
        </div>
      )}
    </>
  );
}

const RING = 2 * Math.PI * 46;

function Summary({ day }: { day: Day }) {
  const s = summary(day);
  return (
    <section
      className={`${styles.card} ${styles.summary}`}
      aria-label="Today's total"
    >
      {s.ring !== null ? (
        <svg
          className={styles.ring}
          viewBox="0 0 112 112"
          role="img"
          aria-label={`${s.ring} percent of today's planned time logged`}
        >
          <circle
            className={styles.ringTrack}
            cx="56"
            cy="56"
            r="46"
            strokeWidth="10"
          />
          <circle
            className={styles.ringFill}
            cx="56"
            cy="56"
            r="46"
            strokeWidth="10"
            strokeDasharray={`${((s.ring / 100) * RING).toFixed(1)} ${RING.toFixed(1)}`}
            transform="rotate(-90 56 56)"
          />
          <text
            className={styles.ringLabel}
            x="56"
            y="62"
            textAnchor="middle"
            fontSize="17"
          >
            {s.ring}%
          </text>
        </svg>
      ) : null}
      <div className={styles.summaryMain}>
        {s.ring === null ? (
          <span className={`${styles.status} ${styles.accent}`}>Day off</span>
        ) : null}
        <span className={styles.total}>{s.total}</span>
        {s.dayOff ? (
          <span className={styles.line}>{s.dayOff}</span>
        ) : (
          <span className={styles.line}>
            logged today · <strong>{s.strong}</strong>
            {s.rest}
          </span>
        )}
        <span className={styles.weekShort}>{s.week} this week</span>
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>This week</span>
          <span className={styles.statValue}>{s.week}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Extra, off days</span>
          <span className={styles.statValue}>{s.extra}</span>
        </div>
      </div>
    </section>
  );
}

/** All, then one option per objective: a segmented control, pills on phone. */
function Filter({
  objectives,
  value,
  onChange,
}: {
  objectives: DayObjective[];
  value: string;
  onChange: (id: string) => void;
}) {
  const options = [
    { id: "all", name: "All" },
    ...objectives.map((o) => ({ id: o.id, name: o.title })),
  ];
  return (
    <div className={styles.filter} role="group" aria-label="Viewing">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={styles.filterBtn}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          <span className={styles.cut}>{o.name}</span>
        </button>
      ))}
    </div>
  );
}

function Entries({ rows }: { rows: EntryRow[] }) {
  return (
    <ul className={styles.entries}>
      {rows.map((r) => (
        <li key={r.id} className={styles.entry}>
          <span className={styles.entryTime}>{r.time}</span>
          <span className={styles.entryNote}>{r.note}</span>
          <span className={styles.entryMins}>{r.minutes}</span>
        </li>
      ))}
    </ul>
  );
}

function PlannedCard({ o, date }: { o: DayObjective; date: string }) {
  const c = card(o, date);
  if (c.kind !== "planned") return null;
  const pct = Math.round(c.progress * 100);
  const rows = entryRows(o);
  return (
    <section className={styles.card} aria-labelledby={`t-${o.id}`}>
      <div className={styles.cardTop}>
        <div className={styles.cardHead}>
          <span className={styles.pill}>{schedulePill(o.schedule.label)}</span>
          <span className={`${styles.note} ${c.met ? styles.met : ""}`}>
            {c.note}
          </span>
        </div>
        <h2 className={styles.cardTitle} id={`t-${o.id}`}>
          {o.title}
        </h2>
      </div>
      <div className={styles.progress}>
        <span className={styles.figure}>
          {c.logged} <span className={styles.of}>/ {c.of}</span>
        </span>
        <div
          className={styles.bar}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${o.title}, ${pct} percent`}
        >
          <div className={styles.barFill} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {rows.length > 0 ? (
        <Entries rows={rows} />
      ) : (
        <p className={styles.nothing}>Nothing logged yet today.</p>
      )}
    </section>
  );
}

function OtherCard({ o, date }: { o: DayObjective; date: string }) {
  const c = card(o, date);
  const rows = entryRows(o);
  return (
    <section className={styles.muted} aria-labelledby={`t-${o.id}`}>
      <div className={styles.mutedText}>
        <h2 className={styles.mutedTitle} id={`t-${o.id}`}>
          {o.title}
        </h2>
        <span className={styles.sub}>{c.note}</span>
      </div>
      {rows.length > 0 ? (
        <div className={styles.mutedLog}>
          <Entries rows={rows} />
        </div>
      ) : null}
    </section>
  );
}

function Adherence({
  objectives,
  date,
}: {
  objectives: DayObjective[];
  date: string;
}) {
  return (
    <section className={styles.card}>
      <div className={styles.railHead}>
        <h2 className={styles.heading}>Adherence</h2>
        <span className={styles.meta}>Plan to date</span>
      </div>
      <ul className={styles.adh}>
        {objectives.map((o) => {
          const r = railRow(o, date);
          return (
            <li key={o.id} className={styles.adhRow}>
              <div className={styles.adhTop}>
                <span className={`${styles.adhName} ${styles.cut}`}>
                  {o.title}
                </span>
                <span className={styles.adhEnd}>
                  {r.kind === "track" ? (
                    <>
                      <span className={`${styles.status} ${styles[r.tone]}`}>
                        {r.pill}
                      </span>
                      <span className={styles.adhPct}>{r.pct}%</span>
                    </>
                  ) : (
                    <span className={`${styles.status} ${styles.neutral}`}>
                      {r.text}
                    </span>
                  )}
                </span>
              </div>
              <div
                className={`${styles.bar} ${styles.barSm}`}
                aria-hidden="true"
              >
                <div
                  className={`${styles.barFill} ${r.kind === "track" ? styles[`fill_${r.tone}`] : ""}`}
                  style={{ width: `${r.kind === "track" ? r.pct : 0}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A new account: one card, and the way to New objective. */
function EmptyToday() {
  return (
    <section className={`${styles.card} ${styles.emptyCard}`}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <circle cx="8" cy="8" r="6" />
          <circle cx="8" cy="8" r="2.2" />
        </svg>
      </span>
      <h2 className={styles.emptyTitle}>Add your first objective</h2>
      <p className={styles.emptyText}>
        An objective is something you&rsquo;re working toward and the time you
        plan to give it. Add one and Today will show your plan and what
        you&rsquo;ve logged against it.
      </p>
      <Link className={shell.primary} href="/objectives/new">
        <PlusIcon />
        Add objective
      </Link>
    </section>
  );
}
