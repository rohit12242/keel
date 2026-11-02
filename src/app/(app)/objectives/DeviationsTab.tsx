"use client";

import Link from "next/link";
import { useState } from "react";
import type { DeviationList, Objective } from "@/shared/contract";
import {
  byWeek,
  mostRecent,
  NONE_ON_OBJECTIVE,
  tabSummary,
  type WeekRow,
} from "@/modules/deviations/domain/deviationView";
import { KindPill } from "../deviations/KindPill";
import { DeviationItem, DeviationWeekDialog } from "./DeviationWeekDialog";
import styles from "./objectives.module.css";

/** When the objective's deviations couldn't be read, the tab says so. */
export const DEVIATIONS_FAILED = "Couldn't load deviations. Try again.";

/**
 * The Deviations tab (04-objectives.md): the summary line, Most recent and
 * By week over the plan's weeks, each week opening its days. Every figure
 * is the API's cost, or its deviations' minutes added; the words are
 * `modules/deviations/domain/deviationView.ts`.
 */
export function DeviationsTab({
  o,
  deviations,
  today,
}: {
  o: Objective;
  deviations: DeviationList | null;
  today: string;
}) {
  const [open, setOpen] = useState<WeekRow | null>(null);
  if (!deviations) {
    return (
      <p className={styles.empty} role="alert">
        {DEVIATIONS_FAILED}
      </p>
    );
  }
  const summary = tabSummary(deviations.cost);
  const recent = mostRecent(deviations.deviations, today);
  if (!summary || !recent) {
    return <p className={styles.empty}>{NONE_ON_OBJECTIVE}</p>;
  }
  const rows = byWeek(o.weeks, deviations.deviations, today);

  return (
    <>
      <p className={styles.devSum}>
        <span>
          {summary.count} · <span className={styles.devM}>{summary.all}</span>{" "}
          off plan
        </span>
        <span className={styles.devChosen}>
          Chosen <span className={styles.devM}>{summary.chosen}</span>
        </span>
        <span className={styles.devDrifted}>
          Drifted <span className={styles.devM}>{summary.drifted}</span>
        </span>
      </p>

      <section className={styles.sec} aria-labelledby="od-recent">
        <div className={styles.secHead}>
          <h3 id="od-recent">Most recent</h3>
          {recent.openable ? (
            <Link className={styles.link} href={`/deviations/${recent.id}`}>
              Open in Deviations
            </Link>
          ) : null}
        </div>
        <div className={styles.devCard}>
          <div className={styles.devMeta}>
            <span className={styles.date}>{recent.date}</span>
            <KindPill kind={recent.kind} />
          </div>
          <DeviationItem item={recent} />
        </div>
      </section>

      {rows.length > 0 ? (
        <section className={styles.sec} aria-labelledby="od-dweeks">
          <div className={styles.secHead}>
            <h3 id="od-dweeks">By week</h3>
            <span className={styles.hint}>Open a week to see each day</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Week</th>
                  <th scope="col" className={styles.r}>
                    Deviations
                  </th>
                  <th scope="col" className={styles.r}>
                    Chosen
                  </th>
                  <th scope="col" className={styles.r}>
                    Drifted
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.n}>
                    <td>
                      {r.count > 0 ? (
                        <button
                          type="button"
                          className={styles.week}
                          onClick={() => setOpen(r)}
                        >
                          {r.label}
                        </button>
                      ) : (
                        <span className={styles.weekQuiet}>{r.label}</span>
                      )}
                      {r.soFar ? (
                        <span className={styles.hint}> so far</span>
                      ) : null}
                    </td>
                    <td className={styles.r}>{r.count}</td>
                    <td className={styles.r}>{r.chosen}</td>
                    <td className={styles.r}>{r.drifted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <DeviationWeekDialog
        row={open}
        deviations={deviations.deviations}
        today={today}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
