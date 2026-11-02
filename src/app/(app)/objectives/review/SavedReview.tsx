import Link from "next/link";
import { BackIcon, ForwardIcon, LockIcon } from "@/app/icons";
import type {
  DueReview,
  Review,
  ReviewSummary,
  ScheduleDay,
} from "@/shared/contract";
import { LOCK_NOTE, REFLECT } from "@/modules/reviews/domain/reviewForm";
import {
  cardTitles,
  changeSetIn,
  checkedIn,
  chosenCard,
  IMPROVEMENT,
  IMPROVEMENT_TONE,
  neighbours,
  nothingToCheck,
  unitOf,
  VERDICT,
  type Neighbour,
} from "@/modules/reviews/domain/reviewView";
import { KindPill } from "../../deviations/KindPill";
import { Pill } from "../ObjectiveDetail";
import { Numbers } from "./Numbers";
import form from "../new/newObjective.module.css";
import styles from "./review.module.css";

/**
 * A saved review, read only (05-reviews.md, *Saved review*): the lock note,
 * previous and next, and the four cards as they were answered. Its figures
 * are recomputed from the record (G21). Nothing here writes.
 */
export function SavedReview({
  review,
  previous,
  grid,
  list,
  due,
  today,
}: {
  review: Review;
  previous: Review | null;
  grid: ScheduleDay[] | null;
  list: ReviewSummary[];
  due: DueReview[];
  today: string;
}) {
  const titles = cardTitles(review.kind, true);
  const nav = neighbours(review, list, due);
  const chosen = chosenCard(review, today);
  const base = `/objectives/${review.objective_id}/reviews`;
  return (
    <div className={form.form}>
      <p className={styles.lock}>
        <LockIcon />
        {LOCK_NOTE}
      </p>
      <nav className={styles.nav} aria-label="Other reviews">
        <NavButton n={nav.previous} base={base} side="previous" />
        <NavButton n={nav.next} base={base} side="next" />
      </nav>

      <Numbers review={review} previous={previous} grid={grid} today={today} />

      <section className={form.card} aria-labelledby="rv-change">
        <CardHead id="rv-change" n={2} title={titles.change} />
        {review.previous_what_changes_next ? (
          <>
            <p className={styles.quote}>
              &ldquo;{review.previous_what_changes_next}&rdquo;
              <small>{changeSetIn(previous, true)}</small>
            </p>
            {review.improvement_answer ? (
              <div className={styles.done}>
                <span>How it went</span>
                <Pill
                  pill={{
                    text: IMPROVEMENT[review.improvement_answer],
                    tone: IMPROVEMENT_TONE[review.improvement_answer],
                  }}
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className={styles.done}>
            <span>{nothingToCheck(true)}</span>
            <Pill pill={{ text: "Nothing to check", tone: "neutral" }} />
          </div>
        )}
      </section>

      <section className={form.card} aria-labelledby="rv-chosen">
        <CardHead
          id="rv-chosen"
          n={3}
          title={titles.chosen}
          hint={chosen.hint}
        />
        {chosen.blocks.length === 0 ? (
          <div className={styles.done}>
            <span>{chosen.none}</span>
            <span className={form.hint}>Nothing to judge</span>
          </div>
        ) : (
          chosen.blocks.map((b) => {
            const verdict = b.verdict ?? b.locked;
            return (
              <div key={b.id} className={styles.chosen}>
                <div className={styles.meta}>
                  <span>{b.when}</span>
                  <KindPill kind="chosen" />
                </div>
                <b className={styles.what}>{b.what}</b>
                <div className={styles.reason}>
                  <span>Your reasoning</span>
                  {b.reasoning}
                </div>
                {verdict ? (
                  <div className={styles.done}>
                    <span>Did the reasoning hold?</span>
                    <Pill
                      pill={{
                        text: VERDICT[verdict],
                        tone: verdict === "worth_it" ? "ok" : "behind",
                      }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      <section className={form.card} aria-labelledby="rv-reflect">
        <CardHead id="rv-reflect" n={4} title={titles.reflect} />
        {REFLECT.map(({ field, label }) => {
          const next = field === "what_changes_next";
          return (
            <div key={field} className={styles.answer}>
              <span className={form.label}>{label(unitOf(review.kind))}</span>
              <p className={next ? styles.next : undefined}>
                {review[field] ?? ""}
              </p>
              {next && review.what_changes_next ? (
                <span className={form.hint}>
                  {checkedIn(review, list, due)}
                </span>
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}

export function CardHead({
  id,
  n,
  title,
  hint,
}: {
  id: string;
  n: number;
  title: string;
  hint?: string | null;
}) {
  return (
    <div className={styles.cardHead}>
      <h2 id={id}>
        <span className={styles.num} aria-hidden="true">
          {n}
        </span>
        {title}
      </h2>
      {hint ? <span className={form.hint}>{hint}</span> : null}
    </div>
  );
}

function NavButton({
  n,
  base,
  side,
}: {
  n: Neighbour;
  base: string;
  side: "previous" | "next";
}) {
  const icon = side === "previous" ? <BackIcon /> : <ForwardIcon />;
  const body =
    side === "previous" ? (
      <>
        {icon}
        {n.text}
      </>
    ) : (
      <>
        {n.text}
        {icon}
      </>
    );
  return n.kind === "link" ? (
    <Link
      className={styles.navb}
      href={`${base}/${n.id}`}
      aria-label={`${side === "previous" ? "Previous" : "Next"} review: ${n.text}`}
    >
      {body}
    </Link>
  ) : (
    <span className={styles.navb} aria-disabled="true">
      {body}
    </span>
  );
}
