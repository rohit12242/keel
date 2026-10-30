"use client";

import { useState } from "react";
import type { Objective } from "@/shared/contract";
import {
  lastDay,
  weekRows,
  type WeekRow,
} from "@/modules/objectives/domain/effortView";
import { Entries, Tag } from "./EffortParts";
import { READ_FAILED, useDays } from "./useDays";
import { WeekDialog } from "./WeekDialog";
import styles from "./objectives.module.css";

/**
 * The Effort tab (04-objectives.md): Last day, then By week, each week
 * opening its days. The words are `modules/objectives/domain/effortView.ts`;
 * a day's figures come from the schedule grid, its entries from the API.
 */

export function EffortTab({ o, today }: { o: Objective; today: string }) {
  const rows = weekRows(o, today);
  const [open, setOpen] = useState<WeekRow | null>(null);
  return (
    <>
      <section className={styles.sec} aria-labelledby="od-last">
        <div className={styles.secHead}>
          <h3 id="od-last">Last day</h3>
          <span className={styles.hint}>The last day you logged effort</span>
        </div>
        <LastDay o={o} today={today} />
      </section>

      {rows.length > 0 ? (
        <section className={styles.sec} aria-labelledby="od-weeks">
          <div className={styles.secHead}>
            <h3 id="od-weeks">By week</h3>
            <span className={styles.hint}>Open a week to see each day</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Week</th>
                  <th scope="col" className={styles.r}>
                    Planned
                  </th>
                  <th scope="col" className={styles.r}>
                    Logged
                  </th>
                  <th scope="col" className={styles.r}>
                    Days met
                  </th>
                  <th scope="col" className={styles.r}>
                    Over plan
                  </th>
                  <th scope="col" className={styles.r}>
                    Unplanned day effort
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.n}>
                    <td>
                      <button
                        type="button"
                        className={styles.week}
                        onClick={() => setOpen(r)}
                      >
                        {r.label}
                      </button>
                      {r.soFar ? (
                        <span className={styles.hint}> so far</span>
                      ) : null}
                    </td>
                    <td className={styles.r}>{r.planned}</td>
                    <td className={styles.r}>{r.logged}</td>
                    <td className={styles.r}>{r.met}</td>
                    <td className={styles.r}>{r.over}</td>
                    <td className={styles.r}>{r.unplanned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <WeekDialog
        objectiveId={o.id}
        row={open}
        today={today}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

function LastDay({ o, today }: { o: Objective; today: string }) {
  const date = o.last_logged_on;
  const days = useDays(o.id, date ? { from: date, to: date } : null);
  if (!date) return <p className={styles.empty}>Nothing logged yet.</p>;
  if (days.state === "loading") {
    return (
      <p className={styles.empty} aria-busy="true">
        Loading…
      </p>
    );
  }
  if (days.state === "failed") {
    return (
      <p className={styles.empty} role="alert">
        {READ_FAILED}
      </p>
    );
  }
  const card = lastDay(o, days.grid, days.entries, today);
  if (card.kind === "none") return <p className={styles.empty}>{card.text}</p>;
  return (
    <div className={styles.last}>
      <div className={styles.lastTop}>
        <span>
          <b>{card.title}</b>
          <span className={styles.hint}>{card.line}</span>
        </span>
        {card.bar ? (
          <span
            className={styles.track}
            role="img"
            aria-label={`${card.logged} logged against the target`}
          >
            <i
              className={card.bar.met ? styles.fillMet : styles.fillShort}
              style={{ width: `${card.bar.pct}%` }}
            />
            <span className={styles.target} />
          </span>
        ) : (
          <span />
        )}
        <span className={styles.lastValue}>
          <strong>{card.logged}</strong>
          <Tag tag={card.tag} />
        </span>
      </div>
      <Entries rows={card.rows} />
    </div>
  );
}
