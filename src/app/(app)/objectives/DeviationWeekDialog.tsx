"use client";

import { useState } from "react";
import type { Deviation } from "@/shared/contract";
import {
  deviationWeek,
  type Item,
  type WeekRow,
} from "@/modules/deviations/domain/deviationView";
import { Dialog, dialogParts as parts } from "../Dialog";
import { KindPill } from "../deviations/KindPill";
import styles from "./objectives.module.css";

/**
 * A week of deviations (04-objectives.md, *Deviations tab*): the week's
 * count and time, a chip per day, and one block per day up to today, from
 * the deviations the page already holds. Read-only; Esc, × and Close close
 * it, and focus goes back to the week that opened it.
 */
export function DeviationWeekDialog({
  row,
  deviations,
  today,
  onClose,
}: {
  row: WeekRow | null;
  deviations: readonly Deviation[];
  today: string;
  onClose: () => void;
}) {
  const view = row ? deviationWeek(row, deviations, today) : null;
  return (
    <Dialog
      open={view !== null}
      title={view?.title ?? ""}
      onClose={onClose}
      wide
    >
      {view ? (
        // A new body per week, so one week's day choice never carries over.
        <WeekBody key={row?.n} view={view} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function WeekBody({
  view,
  onClose,
}: {
  view: ReturnType<typeof deviationWeek>;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState("all");
  const shown = view.days.filter((d) => chosen === "all" || d.date === chosen);
  return (
    <div className={parts.form}>
      <div className={parts.body}>
        <p className={styles.sub}>{view.sub}</p>
        <div className={styles.chips} role="group" aria-label="Days">
          {[{ date: "all", chip: "All days" }, ...view.days].map((d) => (
            <button
              key={d.date}
              type="button"
              className={styles.chip}
              aria-pressed={chosen === d.date}
              onClick={() => setChosen(d.date)}
            >
              {d.chip}
            </button>
          ))}
        </div>
        {shown.map((d) => (
          <section key={d.date} className={styles.dayBlock}>
            <div className={styles.dayHead}>
              <b>{d.title}</b>
            </div>
            {d.empty ? (
              <p className={styles.empty}>{d.empty}</p>
            ) : (
              d.items.map((item) => (
                <div key={item.id} className={styles.devCard}>
                  <div className={styles.devMeta}>
                    <KindPill kind={item.kind} />
                  </div>
                  <DeviationItem item={item} />
                </div>
              ))
            )}
          </section>
        ))}
      </div>
      <div className={parts.foot}>
        <div className={parts.start}>
          <span className={parts.keys}>esc to close</span>
        </div>
        <div className={parts.actions}>
          <button
            type="button"
            className={parts.muted}
            data-autofocus
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** What happened, "5h 00m · pattern", and a chosen one's reasoning. */
export function DeviationItem({ item }: { item: Item }) {
  return (
    <>
      <b className={styles.devText}>{item.text}</b>
      <span className={styles.hint}>{item.line}</span>
      {item.reasoning ? (
        <div className={`${styles.blk} ${styles.devReason}`}>
          <span className={styles.lbl}>Your reasoning</span>
          <p className={styles.p}>{item.reasoning}</p>
        </div>
      ) : null}
    </>
  );
}
