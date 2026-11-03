import Link from "next/link";
import { BackIcon, ForwardIcon, LockIcon } from "@/app/icons";
import type {
  DueReview,
  Objective,
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
import {
  CRITERIA,
  CRITERIA_TONE,
  criteriaSet,
  whatNext,
} from "@/modules/reviews/domain/finalReview";
import { KindPill } from "../../deviations/KindPill";
import { Pill } from "../ObjectiveDetail";
import { MakeExtension } from "./MakeExtension";
import { Numbers } from "./Numbers";
import { PlanNumbers } from "./PlanNumbers";
import form from "../new/newObjective.module.css";
import styles from "./review.module.css";

/**
 * A saved review, read only (05-reviews.md, *Saved review*): the lock note,
 * previous and next, and the four cards as they were answered — five for a
 * final review. Its figures
 * are recomputed from the record (G21). Nothing here writes.
 */
export function SavedReview({
  review,
  previous,
  grid,
  list,
  due,
  objective,
  extend = false,
  today,
}: {
  review: Review;
  previous: Review | null;
  grid: ScheduleDay[] | null;
  list: ReviewSummary[];
  due: DueReview[];
  objective: Objective;
  /** Open Make the extension's fields at once (`?extend=1`, G49). */
  extend?: boolean;
  today: string;
}) {
  const nav = neighbours(review, list, due);
  const base = `/objectives/${review.objective_id}/reviews`;
  const head = (
    <>
      <p className={styles.lock}>
        <LockIcon />
        {LOCK_NOTE}
      </p>
      <nav className={styles.nav} aria-label="Other reviews">
        <NavButton n={nav.previous} base={base} side="previous" />
        <NavButton n={nav.next} base={base} side="next" />
      </nav>
    </>
  );
  if (review.kind === "plan_end") {
    return (
      <div className={form.form}>
        {head}
        <SavedFinal
          review={review}
          previous={previous}
          objective={objective}
          extend={extend}
          today={today}
        />
      </div>
    );
  }
  const titles = cardTitles(review.kind, true);
  const chosen = chosenCard(review, today);
  return (
    <div className={form.form}>
      {head}
      <Numbers review={review} previous={previous} grid={grid} today={today} />

      <section className={form.card} aria-labelledby="rv-change">
        <CardHead id="rv-change" n={2} title={titles.change} />
        <ChangeAnswered review={review} previous={previous} />
      </section>

      <section className={form.card} aria-labelledby="rv-chosen">
        <CardHead
          id="rv-chosen"
          n={3}
          title={titles.chosen}
          hint={chosen.hint}
        />
        <ChosenAnswered review={review} today={today} />
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

/**
 * The saved final review's five cards (05-reviews.md, *Saved review*): the
 * whole plan, the last change and Chosen deviations, Success criteria with
 * its verdict, Reflect, and What next.
 */
function SavedFinal({
  review,
  previous,
  objective: o,
  extend,
  today,
}: {
  review: Review;
  previous: Review | null;
  objective: Objective;
  extend: boolean;
  today: string;
}) {
  const chosen = chosenCard(review, today);
  const next = whatNext(review, o, today);
  return (
    <>
      <PlanNumbers review={review} weeks={o.weeks} startDate={o.start_date} />

      <section className={form.card} aria-labelledby="rv-change">
        <CardHead
          id="rv-change"
          n={2}
          title="Last change and Chosen deviations"
        />
        <ChangeAnswered review={review} previous={previous} />
        <h3 className={styles.sub3}>Chosen deviations in the last week</h3>
        <ChosenAnswered review={review} today={today} hint={chosen.hint} />
      </section>

      <section className={form.card} aria-labelledby="rv-criteria">
        <CardHead id="rv-criteria" n={3} title="Success criteria" />
        <p className={styles.quote}>
          &ldquo;{o.success_criteria}&rdquo;
          <small>{criteriaSet(o, today)}</small>
        </p>
        {review.criteria_verdict ? (
          <div className={styles.done}>
            <span>Where you are</span>
            <Pill
              pill={{
                text: CRITERIA[review.criteria_verdict],
                tone: CRITERIA_TONE[review.criteria_verdict],
              }}
            />
          </div>
        ) : null}
        <div className={styles.answer}>
          <span className={form.label}>What shows it</span>
          <p>{review.criteria_assessment ?? ""}</p>
        </div>
      </section>

      <section className={form.card} aria-labelledby="rv-reflect">
        <CardHead id="rv-reflect" n={4} title="Reflect" />
        {REFLECT.filter((r) => r.field !== "what_changes_next").map(
          ({ field, label }) => (
            <div key={field} className={styles.answer}>
              <span className={form.label}>{label("week")}</span>
              <p>{review[field] ?? ""}</p>
            </div>
          ),
        )}
      </section>

      <section className={form.card} aria-labelledby="rv-next">
        <CardHead id="rv-next" n={5} title="What next" />
        {next === null ? null : next.kind === "pending" ? (
          <MakeExtension
            objective={o}
            reviewId={review.id}
            today={today}
            open={extend}
          />
        ) : next.kind === "extended" ? (
          <div className={styles.answer}>
            <p className={styles.next}>
              <b>{next.text}</b>
              <br />
              {next.schedule}
            </p>
            <span className={form.label}>Why extend</span>
            <p>{next.reason}</p>
          </div>
        ) : (
          <div className={styles.answer}>
            <p className={styles.next}>
              <b>{next.text}</b>
            </p>
          </div>
        )}
      </section>
    </>
  );
}

/** Card 2's change, as answered: the quote and how it went, or nothing to check. */
function ChangeAnswered({
  review,
  previous,
}: {
  review: Review;
  previous: Review | null;
}) {
  return review.previous_what_changes_next ? (
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
  );
}

/** The Chosen deviations of the period, each with its verdict. */
function ChosenAnswered({
  review,
  today,
  hint,
}: {
  review: Review;
  today: string;
  hint?: string | null;
}) {
  const chosen = chosenCard(review, today);
  return (
    <>
      {hint ? <span className={form.hint}>{hint}</span> : null}
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
    </>
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
