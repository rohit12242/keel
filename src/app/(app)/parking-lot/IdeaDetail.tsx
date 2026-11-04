"use client";

import Link from "next/link";
import { BackIcon } from "@/app/icons";
import type { ParkedIdea } from "@/shared/contract";
import { dayLabel } from "@/modules/objectives/domain/newObjective";
import {
  approvedLine,
  caught,
  decidable,
  FINAL,
  lockRule,
  pill,
  takenLine,
  type ObjectiveDates,
} from "@/modules/parking/domain/parkingView";
import layout from "../listDetail.module.css";
import { IdeaPill } from "./IdeaPill";
import { LockInfo } from "./LockInfo";
import styles from "./parkingLot.module.css";

/**
 * An idea's detail (07-parking-lot.md, *Detail*): caught and the pill, the
 * idea, why it grabbed you — and why it ended, when dropped — the approved
 * or taken line, the notes, and the footer.
 */
export function IdeaDetail({
  idea,
  objectives,
  today,
}: {
  idea: ParkedIdea;
  objectives: readonly ObjectiveDates[];
  today: string;
}) {
  const p = pill(idea, today);
  const became = objectives.find((o) => o.id === idea.became_objective_id);
  const dropped = idea.verdict === "dropped";
  return (
    <article className={layout.detail} aria-labelledby="pi-title">
      <Link className={layout.back} href="/parking-lot">
        <BackIcon />
        Parking lot
      </Link>
      <div className={styles.detailHead}>
        <span className={styles.date}>{caught(idea, today)}</span>
        <IdeaPill
          pill={p}
          text={p.detail}
          info={<LockInfo rule={lockRule(idea, objectives, today)} />}
        />
      </div>
      <h2 className={styles.title} id="pi-title">
        {idea.idea}
      </h2>

      <div className={dropped ? styles.pair : undefined}>
        <div className={styles.blk}>
          <span className={styles.lbl}>Why it grabbed you</span>
          <p className={styles.p}>{idea.why}</p>
        </div>
        {dropped ? (
          <div className={styles.blk}>
            <span className={styles.lbl}>Why it ended</span>
            <p className={styles.p}>{idea.note}</p>
          </div>
        ) : null}
      </div>

      {idea.verdict === "approved" ? (
        <p className={styles.approvedLine}>{approvedLine(idea, today)}</p>
      ) : null}
      {idea.verdict === "taken" ? (
        <p className={styles.takenLine}>{takenLine(idea, became, today)}</p>
      ) : null}

      <div className={styles.blk}>
        <span className={styles.lbl}>Notes</span>
        {idea.notes.length > 0 ? (
          [...idea.notes].reverse().map((n) => (
            <div key={n.id} className={styles.note}>
              <span className={styles.date}>
                {dayLabel(n.written_on, today)}
              </span>
              <p className={styles.p}>{n.text}</p>
            </div>
          ))
        ) : (
          <p className={styles.empty}>No notes yet.</p>
        )}
      </div>

      {decidable(idea) ? null : (
        <div className={styles.foot}>
          <p className={styles.fine}>{FINAL}</p>
        </div>
      )}
    </article>
  );
}
