import type { PlanWeek, Review } from "@/shared/contract";
import { tiles } from "@/modules/reviews/domain/reviewView";
import { RECOMPUTED } from "@/modules/reviews/domain/reviewForm";
import { planHint, planRows } from "@/modules/reviews/domain/finalReview";
import form from "../new/newObjective.module.css";
import styles from "./review.module.css";

/**
 * Card 1 of the final review, "The plan in numbers" (05-reviews.md): the
 * five tiles over the whole plan with no comparison (G22), then one
 * adherence row per plan week, from `Objective.weeks` up to the review's end.
 */
export function PlanNumbers({
  review,
  weeks,
  startDate,
}: {
  review: Review;
  weeks: PlanWeek[];
  startDate: string;
}) {
  const saved = review.status === "saved";
  const t = tiles(review, null);
  const rows = planRows(weeks, review.period_end);
  const hint = planHint(startDate, review.period_end);
  return (
    <section className={form.card} aria-labelledby="rv-numbers">
      <div className={styles.cardHead}>
        <h2 id="rv-numbers">
          <span className={styles.num} aria-hidden="true">
            1
          </span>
          The plan in numbers
        </h2>
        <span className={form.hint}>
          {saved ? `${hint} · ${RECOMPUTED}` : hint}
        </span>
      </div>
      <div className={styles.tiles}>
        {t.tiles.map((x) => (
          <div
            key={x.label}
            className={`${styles.tile} ${x.tone ? styles[`tile_${x.tone}`] : ""}`}
          >
            <span className={form.hint}>{x.label}</span>
            <strong>{x.value}</strong>
            {x.hint ? <span className={form.hint}>{x.hint}</span> : null}
          </div>
        ))}
      </div>
      <ul className={styles.weeks} aria-label="Adherence by week">
        {rows.map((w) => (
          <li key={w.key} className={`${styles.wrow} ${styles.prow}`}>
            <span className={form.hint}>{w.label}</span>
            <span className={styles.track} aria-hidden="true">
              <i
                className={styles[`fill_${w.tone}`]}
                style={{ width: `${Math.min(100, w.pct)}%` }}
              />
            </span>
            <span className={styles.mono}>{w.pctText}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
