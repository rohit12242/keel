import type { Deviation, Figures } from "@/shared/contract";
import { figures, type DailyMinutes } from "@/modules/effort/domain/adherence";
import { datesBetween } from "@/modules/objectives/domain/generateSlots";
import type { PlannedSlot } from "@/modules/objectives/domain/planSlots";
import type { ObjectiveStatus } from "@/modules/objectives/domain/statusTimeline";
import {
  assembleIdea,
  type IdeaRow,
  type ParkedIdea,
} from "@/modules/parking/domain/parking";
import { dueWindows, periodKey, type LabelledWindow } from "./reviewWindows";

/**
 * A review as the contract shows it (ADR-001 domain: pure). A review row holds
 * answers only (invariant 14); everything else — the figures, the bars, the
 * deviations and ideas of the period, the review before it — is recomputed
 * from the record every time it is read.
 */

export type ReviewRow = {
  id: string;
  objective_id: string;
  kind: "weekly" | "monthly" | "plan_end";
  period_start: string;
  period_end: string;
  status: "draft" | "saved";
  previous_review_id: string | null;
  improvement_answer: "yes" | "partly" | "no" | "not_tried" | null;
  improvement_answer_note: string | null;
  what_worked: string | null;
  what_got_in_the_way: string | null;
  what_changes_next: string | null;
  review_summary: string | null;
  criteria_assessment: string | null;
  criteria_verdict: "met" | "partly_met" | "not_met" | null;
  outcome: "continued" | "completed" | "paused" | "ended" | null;
  saved_at: string | null;
};

export type ReviewSummary = {
  id: string;
  kind: ReviewRow["kind"];
  label: string;
  period_start: string;
  period_end: string;
  status: ReviewRow["status"];
  saved_at: string | null;
  outcome: ReviewRow["outcome"];
  review_summary: string | null;
  adherence_pct: number | null;
};

export type Review = ReviewSummary & {
  objective_id: string;
  due_on: string;
  improvement_answer: ReviewRow["improvement_answer"];
  improvement_answer_note: string | null;
  what_worked: string | null;
  what_got_in_the_way: string | null;
  what_changes_next: string | null;
  criteria_assessment: string | null;
  criteria_verdict: ReviewRow["criteria_verdict"];
  previous_review_id: string | null;
  previous_what_changes_next: string | null;
  figures: Required<Figures>;
  minutes_per_day: { date: string; minutes: number; planned: boolean }[];
  deviations: Deviation[];
  parked_ideas: ParkedIdea[];
};

/** Everything a review is computed from, for one objective. */
export type ReviewFacts = {
  schedule: readonly LabelledWindow[];
  slots: readonly PlannedSlot[];
  daily: DailyMinutes;
  reviews: readonly ReviewRow[];
  /** Deviations naming the objective, any date. */
  deviations: readonly Deviation[];
  /** The owner's ideas, any date. */
  ideas: readonly IdeaRow[];
};

type Period = { period_start: string; period_end: string };
const inPeriod = (date: string, p: Period) =>
  date >= p.period_start && date <= p.period_end;

/**
 * The figures over one window. A slot belongs to the window its period
 * starts in; minutes count only on the window's days. A day covered by any
 * slot of the plan is not extra, even one whose slot started in the window
 * before.
 */
export function windowFigures(
  window: Period,
  slots: readonly PlannedSlot[],
  daily: DailyMinutes,
): Required<Figures> {
  const inside = Object.fromEntries(
    Object.entries(daily).filter(([d]) => inPeriod(d, window)),
  );
  const f = figures(
    slots.filter((s) => inPeriod(s.periodStart, window)),
    inside,
  );
  const covered = new Set(slots.flatMap((s) => s.activeDays));
  f.extra_off_day_minutes = Object.entries(inside)
    .filter(([d]) => !covered.has(d))
    .reduce((sum, [, m]) => sum + m, 0);
  return f;
}

/** The window's label — Week 3, End of plan — or the kind when it is not in the schedule. */
function labelOf(review: ReviewRow, schedule: readonly LabelledWindow[]) {
  const w = schedule.find((s) => periodKey(s) === periodKey(review));
  return w ? w.label : review.kind === "plan_end" ? "End of plan" : review.kind;
}

/**
 * The review this one answers: stored once saved; for a draft, the most
 * recent saved review of the objective that ended before this period began
 * (docs/domain/review-windows.md, G-07).
 */
export function previousOf(
  review: ReviewRow,
  reviews: readonly ReviewRow[],
): ReviewRow | null {
  if (review.status === "saved") {
    return reviews.find((r) => r.id === review.previous_review_id) ?? null;
  }
  let found: ReviewRow | null = null;
  for (const r of reviews) {
    if (
      r.status === "saved" &&
      r.period_end < review.period_start &&
      (found === null || r.period_end > found.period_end)
    ) {
      found = r;
    }
  }
  return found;
}

export function summaryOf(
  review: ReviewRow,
  facts: ReviewFacts,
): ReviewSummary {
  return {
    id: review.id,
    kind: review.kind,
    label: labelOf(review, facts.schedule),
    period_start: review.period_start,
    period_end: review.period_end,
    status: review.status,
    saved_at: review.saved_at,
    outcome: review.outcome,
    review_summary: review.review_summary,
    adherence_pct: windowFigures(review, facts.slots, facts.daily)
      .adherence_pct,
  };
}

/**
 * An idea as it stood at the end of the period: its verdicts up to then, and
 * locked or not as of that day.
 */
export function ideaAsOf(row: IdeaRow, date: string): ParkedIdea {
  const verdicts = row.verdicts.filter((v) => v.occurred_on <= date);
  const taken = verdicts.some((v) => v.verdict === "taken");
  return assembleIdea(
    {
      ...row,
      verdicts,
      became_objective_id: taken ? row.became_objective_id : null,
    },
    date,
  );
}

export function assembleReview(review: ReviewRow, facts: ReviewFacts): Review {
  const previous = previousOf(review, facts.reviews);
  const covered = new Set(facts.slots.flatMap((s) => s.activeDays));
  return {
    ...summaryOf(review, facts),
    objective_id: review.objective_id,
    due_on: review.period_end,
    improvement_answer: review.improvement_answer,
    improvement_answer_note: review.improvement_answer_note,
    what_worked: review.what_worked,
    what_got_in_the_way: review.what_got_in_the_way,
    what_changes_next: review.what_changes_next,
    criteria_assessment: review.criteria_assessment,
    criteria_verdict: review.criteria_verdict,
    previous_review_id: previous?.id ?? null,
    previous_what_changes_next: previous?.what_changes_next ?? null,
    figures: windowFigures(review, facts.slots, facts.daily),
    minutes_per_day: datesBetween(review.period_start, review.period_end).map(
      (date) => ({
        date,
        minutes: facts.daily[date] ?? 0,
        planned: covered.has(date),
      }),
    ),
    deviations: facts.deviations.filter((d) => inPeriod(d.local_date, review)),
    parked_ideas: facts.ideas
      .filter((i) => inPeriod(i.caught_on, review))
      .map((i) => ideaAsOf(i, review.period_end)),
  };
}

export type StartRequest = Period | null;

export type StartDecision =
  | { kind: "resume"; review: ReviewRow }
  | { kind: "create"; window: LabelledWindow }
  | { kind: "nothing_due" }
  | { kind: "not_a_window" }
  | { kind: "not_closed" }
  | { kind: "saved" };

/**
 * Start or resume a review. With no period named, the earliest due window;
 * with one, it must be a real window of this objective that has closed.
 * A draft for the period is resumed; a saved review for it is a conflict.
 */
export function startDecision(input: {
  request: StartRequest;
  schedule: readonly LabelledWindow[];
  reviews: readonly ReviewRow[];
  slots: readonly PlannedSlot[];
  status: ObjectiveStatus | null;
  today: string;
}): StartDecision {
  const { request, schedule, reviews, today } = input;
  let window: LabelledWindow | undefined;
  if (request === null) {
    window = dueWindows({
      schedule,
      today,
      status: input.status,
      saved: new Set(
        reviews.filter((r) => r.status === "saved").map(periodKey),
      ),
      slots: input.slots,
    })[0];
    if (!window) return { kind: "nothing_due" };
  } else {
    window = schedule.find((w) => periodKey(w) === periodKey(request));
    if (!window) return { kind: "not_a_window" };
    if (today < window.period_end) return { kind: "not_closed" };
  }
  const existing = reviews.find((r) => periodKey(r) === periodKey(window));
  if (existing?.status === "saved") return { kind: "saved" };
  if (existing) return { kind: "resume", review: existing };
  return { kind: "create", window };
}
