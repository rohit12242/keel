"use client";

import { useState } from "react";
import {
  weekDialog,
  type WeekRow,
} from "@/modules/objectives/domain/effortView";
import { Dialog, dialogParts as parts } from "../Dialog";
import { Entries, Tag } from "./EffortParts";
import { READ_FAILED, useDays } from "./useDays";
import styles from "./objectives.module.css";

/**
 * The week dialog (04-objectives.md, *Effort tab*): the week's figures, a
 * chip per day, and one block per day up to today. Read-only; Esc, × and
 * Close close it, and focus goes back to the week that opened it.
 */
export function WeekDialog({
  objectiveId,
  row,
  today,
  onClose,
}: {
  objectiveId: string;
  row: WeekRow | null;
  today: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={row !== null} title={row?.label ?? ""} onClose={onClose} wide>
      {row ? (
        // A new body per week, so one week's days never show under another.
        <WeekBody
          key={row.n}
          objectiveId={objectiveId}
          row={row}
          today={today}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function WeekBody({
  objectiveId,
  row,
  today,
  onClose,
}: {
  objectiveId: string;
  row: WeekRow;
  today: string;
  onClose: () => void;
}) {
  const days = useDays(objectiveId, {
    from: row.week.period_start,
    to: row.week.period_end,
  });
  const [chosen, setChosen] = useState("all");
  const view =
    days.state === "ready"
      ? weekDialog(row, days.grid, days.entries, today)
      : null;
  const shown = view?.days.filter((d) => chosen === "all" || d.date === chosen);

  return (
    <div className={parts.form}>
      <div className={parts.body}>
        {view ? <p className={styles.sub}>{view.sub}</p> : null}
        {days.state === "loading" ? (
          <p className={styles.empty} aria-busy="true">
            Loading…
          </p>
        ) : null}
        {days.state === "failed" ? (
          <p className={styles.empty} role="alert">
            {READ_FAILED}
          </p>
        ) : null}
        {view ? (
          <>
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
            {shown?.map((d) => (
              <section key={d.date} className={styles.dayBlock}>
                <div className={styles.dayHead}>
                  <b>{d.title}</b>
                  <span className={styles.dayEnd}>
                    <strong>{d.logged}</strong>
                    <Tag tag={d.tag} />
                  </span>
                </div>
                {d.empty ? (
                  <p className={styles.empty}>{d.empty}</p>
                ) : (
                  <Entries rows={d.rows} />
                )}
              </section>
            ))}
          </>
        ) : null}
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
