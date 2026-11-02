import type { Review, ScheduleDay } from "@/shared/contract";
import {
  cardTitles,
  dayBars,
  monthWeeks,
  tiles,
} from "@/modules/reviews/domain/reviewView";
import { DAYS_FAILED, RECOMPUTED } from "@/modules/reviews/domain/reviewForm";
import form from "../new/newObjective.module.css";
import styles from "./review.module.css";

/**
 * Card 1, "The week in numbers" (05-reviews.md): the five tiles from the
 * review's figures, compared with the previous saved review, then the day
 * bars (a weekly review) or one row per week (a monthly one), from the
 * schedule grid. `grid` null: the grid couldn't be read, and the card says so
 * rather than drawing empty days.
 */
export function Numbers({
  review,
  previous,
  grid,
  today,
}: {
  review: Review;
  previous: Review | null;
  grid: ScheduleDay[] | null;
  today: string;
}) {
  const saved = review.status === "saved";
  const t = tiles(review, previous);
  const hint = saved ? RECOMPUTED : t.hint;
  return (
    <section className={form.card} aria-labelledby="rv-numbers">
      <div className={styles.cardHead}>
        <h2 id="rv-numbers">
          <span className={styles.num} aria-hidden="true">
            1
          </span>
          {cardTitles(review.kind, saved).numbers}
        </h2>
        {hint ? <span className={form.hint}>{hint}</span> : null}
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
      {grid === null ? (
        <p className={styles.failed} role="alert">
          {DAYS_FAILED}
        </p>
      ) : review.kind === "monthly" ? (
        <MonthWeeks review={review} grid={grid} today={today} />
      ) : (
        <DayBars review={review} grid={grid} />
      )}
    </section>
  );
}

function DayBars({ review, grid }: { review: Review; grid: ScheduleDay[] }) {
  const b = dayBars(grid, review);
  const n = { "--n": b.bars.length } as React.CSSProperties;
  return (
    <div>
      <div className={styles.bars} style={n} role="img" aria-label={b.label}>
        {b.target ? (
          <span className={styles.line} aria-hidden="true">
            <span>{b.target}</span>
          </span>
        ) : null}
        {b.bars.map((x) => (
          <span key={x.date} className={styles.col} aria-hidden="true">
            <span
              className={`${styles.value} ${
                x.style === "missed"
                  ? styles.value_missed
                  : x.style === "off"
                    ? styles.value_off
                    : ""
              }`}
            >
              {x.value}
            </span>
            <span
              className={`${styles.bar} ${x.style === "off" ? "" : styles[`bar_${x.style}`]}`}
              style={{ height: `${x.height}px` }}
            />
          </span>
        ))}
      </div>
      <div className={styles.labels} style={n} aria-hidden="true">
        {b.bars.map((x) => (
          <span key={x.date}>
            <b>{x.day}</b>
            <small className={styles[`word_${x.tone}`]}>{x.word}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function MonthWeeks({
  review,
  grid,
  today,
}: {
  review: Review;
  grid: ScheduleDay[];
  today: string;
}) {
  return (
    <ul className={styles.weeks} aria-label="By week">
      {monthWeeks(grid, review, today).map((w) => (
        <li key={w.range} className={styles.wrow}>
          <span className={form.hint}>{w.range}</span>
          <span className={styles.track} aria-hidden="true">
            <i
              className={styles[`fill_${w.tone}`]}
              style={{ width: `${w.pct}%` }}
            />
          </span>
          <span className={styles.mono}>
            {w.logged} of {w.planned}
          </span>
        </li>
      ))}
    </ul>
  );
}
