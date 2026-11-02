import Link from "next/link";
import { BackIcon } from "@/app/icons";
import {
  CANT_CHANGE,
  type Detail,
} from "@/modules/deviations/domain/deviationView";
import { KindPill } from "./KindPill";
import layout from "../listDetail.module.css";
import styles from "./deviations.module.css";

/**
 * A deviation's detail (06-deviations.md, *Detail*). Nothing here edits or
 * deletes it: there is no endpoint for either, by design. The head carries
 * the kind alone: the contract has no recorded date, and the day it
 * happened is in **When**.
 */
export function DeviationDetail({
  detail: d,
  backHref,
}: {
  detail: Detail;
  /** Where **‹ Deviations** goes on phone. */
  backHref: string;
}) {
  return (
    <article className={layout.detail} aria-labelledby="dd-title">
      <Link className={layout.back} href={backHref}>
        <BackIcon />
        Deviations
      </Link>
      <div className={styles.detailHead}>
        <KindPill kind={d.kind} />
        <h2 className={styles.title} id="dd-title">
          {d.title}
        </h2>
      </div>

      <div className={styles.facts}>
        {d.tiles.map((t, i) => (
          <div key={t.label} className={styles.fact}>
            <span className={styles.lbl}>{t.label}</span>
            <strong className={i === 0 ? styles.big : undefined}>
              {t.value}
            </strong>
          </div>
        ))}
      </div>

      {d.reasoning !== null ? (
        <div className={`${styles.blk} ${styles.reason}`}>
          <span className={styles.lbl}>
            Your reasoning · recorded now, tested at review
          </span>
          <p className={styles.p}>{d.reasoning}</p>
        </div>
      ) : null}

      {d.pattern ? (
        <div className={`${styles.blk} ${styles.pattern}`}>
          <span className={styles.lbl}>Pattern</span>
          <div className={styles.ptop}>
            <strong>{d.pattern.name}</strong>
            {d.pattern.nth ? (
              <span className={styles.times}>{d.pattern.nth}</span>
            ) : null}
          </div>
          {d.pattern.description ? (
            <p className={styles.p}>{d.pattern.description}</p>
          ) : null}
        </div>
      ) : null}

      {d.didInstead ? (
        <div className={styles.blk}>
          <span className={styles.lbl}>What you did instead</span>
          <p className={styles.p}>{d.didInstead}</p>
        </div>
      ) : null}

      <div className={`${styles.blk} ${styles.foot}`}>
        <span className={styles.lbl}>Verdict at review</span>
        <p className={styles.p}>{d.verdict}</p>
        <p className={styles.fine}>{CANT_CHANGE}</p>
      </div>
    </article>
  );
}
