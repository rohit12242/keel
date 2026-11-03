import type {
  Objective,
  PlanSegment,
  PlanWeek,
  Review,
  ReviewSummary,
  ReviewWrite,
} from "@/shared/contract";
import { parseIso } from "@/modules/objectives/domain/generateSlots";
import {
  TEXT_MAX,
  dayLabel,
  digits,
  duration,
  runsForDays,
  targetError,
  targetOf,
  type LengthUnit,
} from "@/modules/objectives/domain/newObjective";
import {
  daysLabel,
  scheduleLine,
  type Tone,
} from "@/modules/objectives/domain/objectiveView";
import {
  extensionSpan,
  type ExtensionSpan,
} from "@/modules/objectives/domain/validateExtension";
import type { Cadence } from "./reviewWindows";
import { ERRORS, hasChange, toJudge, type Answers } from "./reviewForm";
import { adherenceTone, periodRange, type Verdict } from "./reviewView";

/**
 * The final review (`docs/design/screens/05-reviews.md`, *Final review*),
 * pure: the whole plan in numbers, the success criteria, What next, and the
 * extension it may make. Two calls, never one (G9, G49): the review is saved,
 * then the extension is made. The extension's dates come from
 * `extensionSpan`, the rule the server writes them with, so the preview shows
 * what will be planned (I-14).
 */

const DAY_MS = 86_400_000;
const daysIn = (from: string, to: string) =>
  (parseIso(to) - parseIso(from)) / DAY_MS + 1;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dateOf = (date: string) => new Date(parseIso(date)).getUTCDate();

// ---------- The plan in numbers ----------

export type PlanRow = {
  key: string;
  /** "Week 1", or a short last chunk by its days: "Mon 31–4". */
  label: string;
  pct: number;
  pctText: string;
  tone: Tone;
};

/** One row per plan week up to the review's end (G22, `Objective.weeks`). */
export function planRows(
  weeks: readonly PlanWeek[],
  periodEnd: string,
): PlanRow[] {
  const shown = weeks.filter((w) => w.period_end <= periodEnd);
  return shown.map((w, i) => {
    const last = i === shown.length - 1;
    const short = daysIn(w.period_start, w.period_end) < 7;
    const pct = w.figures.adherence_pct;
    return {
      key: w.period_start,
      label:
        last && short
          ? `${WEEKDAYS[new Date(parseIso(w.period_start)).getUTCDay()]} ${dateOf(
              w.period_start,
            )}–${dateOf(w.period_end)}`
          : `Week ${i + 1}`,
      pct,
      pctText: `${pct}%`,
      tone: adherenceTone(pct),
    };
  });
}

/** "All 26 days": from the plan's start to the review's end. */
export const planHint = (startDate: string, periodEnd: string): string =>
  `All ${daysIn(startDate, periodEnd)} days`;

// ---------- Success criteria ----------

export type CriteriaVerdict = NonNullable<Review["criteria_verdict"]>;

export const CRITERIA: Record<CriteriaVerdict, string> = {
  met: "Met",
  partly_met: "Partly met",
  not_met: "Not met",
};
export const CRITERIA_ORDER: readonly CriteriaVerdict[] = [
  "met",
  "partly_met",
  "not_met",
];
export const CRITERIA_TONE: Record<CriteriaVerdict, Tone> = {
  met: "ok",
  partly_met: "risk",
  not_met: "behind",
};
export const CRITERIA_MAX = TEXT_MAX;

/** "Set 9 Aug": the day the criteria were declared, the objective's creation. */
export function criteriaSet(
  o: Pick<Objective, "status_history" | "start_date">,
  today: string,
): string {
  const created =
    o.status_history.find((e) => e.change === "created")?.occurred_on ??
    o.start_date;
  return `Set ${dayLabel(created, today).slice(4)}`;
}

// ---------- What next ----------

export type Outcome = "completed" | "continued";

export const OUTCOMES: readonly { id: Outcome; title: string; body: string }[] =
  [
    {
      id: "completed",
      title: "Complete it",
      body: "It moves to Completed with this review.",
    },
    {
      id: "continued",
      title: "Extend it",
      body: "A later end date. Set the schedule for the extra time.",
    },
  ];

/** The final review's answers: the weekly ones, the criteria, and the outcome. */
export type FinalAnswers = Answers & {
  criteria_verdict: CriteriaVerdict | null;
  criteria_assessment: string;
  outcome: Outcome | null;
};

export const finalAnswersOf = (r: Review): FinalAnswers => ({
  improvement_answer: r.improvement_answer,
  what_worked: r.what_worked ?? "",
  what_got_in_the_way: r.what_got_in_the_way ?? "",
  what_changes_next: r.what_changes_next ?? "",
  criteria_verdict: r.criteria_verdict,
  criteria_assessment: r.criteria_assessment ?? "",
  outcome:
    r.outcome === "completed" || r.outcome === "continued" ? r.outcome : null,
});

const orNull = (s: string) => (s === "" ? null : s);

/** What autosave sends: the final review has no "what changes next". */
export const finalPatch = (a: FinalAnswers): ReviewWrite => ({
  improvement_answer: a.improvement_answer,
  what_worked: orNull(a.what_worked),
  what_got_in_the_way: orNull(a.what_got_in_the_way),
  criteria_verdict: a.criteria_verdict,
  criteria_assessment: orNull(a.criteria_assessment),
  outcome: a.outcome,
});

export const sameFinal = (a: FinalAnswers, b: FinalAnswers): boolean =>
  JSON.stringify(finalPatch(a)) === JSON.stringify(finalPatch(b));

// ---------- The extension ----------

/** The Extend fields as typed. Fixed only (I-09). */
export type ExtendDraft = {
  length: string;
  unit: LengthUnit;
  /** ISO weekdays, 1 = Monday. */
  weekdays: number[];
  hours: string;
  minutes: string;
  cadence: Cadence;
  reason: string;
};

/** "Keep an extension to six months or less": 26 weeks or 6 months. */
export const EXTEND_MAX: Record<LengthUnit, number> = { weeks: 26, months: 6 };
export const REASON_MAX = TEXT_MAX;

const latestOf = (o: Pick<Objective, "segments">): PlanSegment =>
  [...o.segments].sort((a, b) => a.seq - b.seq)[o.segments.length - 1];

/** A segment's weekdays in order; a flexible one (v2) has none. */
const weekdaysOf = (s: PlanSegment): number[] =>
  [...(s.schedule.planned_weekdays ?? [])].sort((a, b) => a - b);

/** The fields filled in from the current plan: its days, target and cadence, for two weeks. */
export function extendDraft(o: Pick<Objective, "segments">): ExtendDraft {
  const s = latestOf(o);
  const m = s.schedule.minutes_per_planned_day;
  return {
    length: "2",
    unit: "weeks",
    weekdays: weekdaysOf(s),
    hours: String(Math.floor(m / 60)),
    minutes: String(m % 60).padStart(2, "0"),
    cadence: s.review_cadence,
    reason: "",
  };
}

/** Whether the schedule fields are the current plan's: Reset has nothing to do. */
export function isCurrent(
  d: ExtendDraft,
  o: Pick<Objective, "segments">,
): boolean {
  const now = extendDraft(o);
  return (
    d.weekdays.join() === now.weekdays.join() &&
    targetOf(d) === targetOf(now) &&
    d.cadence === now.cadence
  );
}

/** The extension's dates, made `today` on the plan `o`, by the server's rule. */
export function extendSpan(
  o: Pick<Objective, "end_date">,
  d: ExtendDraft,
  today: string,
): ExtensionSpan & { days: number } {
  const plansFrom = extensionSpan(o.end_date, today, 1).plans_from;
  const days = runsForDays(plansFrom, Math.max(1, digits(d.length)), d.unit);
  return { ...extensionSpan(o.end_date, today, days), days };
}

/**
 * "Sat 5 – Fri 25 Sep · new end Fri 25 Sep", or after the plan's end,
 * "Plans from Mon 14 Sep · new end Sun 4 Oct".
 */
export function extendPreview(
  o: Pick<Objective, "end_date">,
  d: ExtendDraft,
  today: string,
): string {
  const s = extendSpan(o, d, today);
  const end = `new end ${dayLabel(s.end_date, today)}`;
  return s.plans_from > s.start_date
    ? `Plans from ${dayLabel(s.plans_from, today)} · ${end}`
    : `${periodRange(s.start_date, s.end_date, today)} · ${end}`;
}

/** Under the weekdays and the target: what changed from the current plan. */
export function changedFrom(
  d: ExtendDraft,
  o: Pick<Objective, "segments">,
): { days: string; target: string | null } {
  const s = latestOf(o);
  const now = weekdaysOf(s);
  const n = d.weekdays.length;
  const count = `${n} planned day${n === 1 ? "" : "s"} a week`;
  const sameDays = [...d.weekdays].sort((a, b) => a - b).join() === now.join();
  const was = s.schedule.minutes_per_planned_day;
  return {
    days: sameDays ? count : `Changed from ${daysLabel(now)} · ${count}`,
    target: targetOf(d) === was ? null : `was ${duration(was)} a day`,
  };
}

export const SCHEDULE_HINT =
  "Filled in from the current plan · change what should change";
export const CADENCE_HINT = "Then a final review at the new end";
export const REASON_PLACEHOLDER = "What would the extra time prove?";

// ---------- Checks ----------

export type FinalField =
  | "improvement_answer"
  | `verdict:${string}`
  | "criteria_verdict"
  | "criteria_assessment"
  | "what_worked"
  | "what_got_in_the_way"
  | "outcome"
  | "extend_length"
  | "extend_days"
  | "extend_target"
  | "extend_reason";

export const FINAL_ERRORS = {
  criteria_verdict: "Pick where you are against the success criteria.",
  criteria_assessment: "Write what shows it.",
  outcome: "Pick Complete or Extend.",
  extend_length: "Enter how long to extend.",
  extend_too_long: "Keep an extension to six months or less.",
  extend_days: "Pick at least one day.",
  extend_reason: "Write why the extra time is worth it.",
} as const;

export type FinalChecked =
  | { ok: true }
  | {
      ok: false;
      errors: Partial<Record<FinalField, string>>;
      first: FinalField;
    };

/** The extension's own checks, in page order; also Make the extension's. */
export function extendErrors(
  d: ExtendDraft,
): Partial<Record<FinalField, string>> {
  const errors: Partial<Record<FinalField, string>> = {};
  const n = digits(d.length);
  if (n < 1) errors.extend_length = FINAL_ERRORS.extend_length;
  else if (n > EXTEND_MAX[d.unit]) {
    errors.extend_length = FINAL_ERRORS.extend_too_long;
  }
  if (d.weekdays.length === 0) errors.extend_days = FINAL_ERRORS.extend_days;
  const target = targetError(d);
  if (target) errors.extend_target = target;
  if (d.reason.trim() === "") errors.extend_reason = FINAL_ERRORS.extend_reason;
  return errors;
}

const EXTEND_ORDER: readonly FinalField[] = [
  "extend_length",
  "extend_days",
  "extend_target",
  "extend_reason",
];

/** Every problem at once, in page order, in the design's words. */
export function checkFinal(
  a: FinalAnswers,
  verdicts: Record<string, Verdict | null>,
  r: Pick<Review, "id" | "deviations" | "previous_what_changes_next">,
  d: ExtendDraft,
): FinalChecked {
  const errors: Partial<Record<FinalField, string>> = {};
  const order: FinalField[] = [];
  const fail = (field: FinalField, message: string) => {
    errors[field] = message;
    order.push(field);
  };
  if (hasChange(r) && a.improvement_answer === null) {
    fail("improvement_answer", ERRORS.improvement_answer);
  }
  for (const id of toJudge(r)) {
    if (!verdicts[id]) fail(`verdict:${id}`, ERRORS.verdict);
  }
  if (a.criteria_verdict === null) {
    fail("criteria_verdict", FINAL_ERRORS.criteria_verdict);
  }
  if (a.criteria_assessment.trim() === "") {
    fail("criteria_assessment", FINAL_ERRORS.criteria_assessment);
  }
  if (a.what_worked.trim() === "") fail("what_worked", ERRORS.what_worked);
  if (a.what_got_in_the_way.trim() === "") {
    fail("what_got_in_the_way", ERRORS.what_got_in_the_way);
  }
  if (a.outcome === null) fail("outcome", FINAL_ERRORS.outcome);
  if (a.outcome === "continued") {
    const ext = extendErrors(d);
    for (const f of EXTEND_ORDER) {
      const message = ext[f];
      if (message) fail(f, message);
    }
  }
  return order.length === 0
    ? { ok: true }
    : { ok: false, errors, first: order[0] };
}

/** The body `POST /objectives/{id}/extensions` takes. */
export type ExtensionBody = {
  review_id: string;
  extend_by_days: number;
  reason: string;
  schedule: {
    mode: "fixed";
    planned_weekdays: number[];
    minutes_per_planned_day: number;
  };
  review_cadence: Cadence;
};

export function extensionBody(
  reviewId: string,
  o: Pick<Objective, "end_date">,
  d: ExtendDraft,
  today: string,
): ExtensionBody {
  return {
    review_id: reviewId,
    extend_by_days: extendSpan(o, d, today).days,
    reason: d.reason.trim(),
    schedule: {
      mode: "fixed",
      planned_weekdays: [...d.weekdays].sort((a, b) => a - b),
      minutes_per_planned_day: targetOf(d),
    },
    review_cadence: d.cadence,
  };
}

// ---------- Words ----------

/** The save button names the outcome. */
export const saveLabel = (o: Outcome | null): string =>
  o === "continued"
    ? "Save review and extend"
    : o === "completed"
      ? "Save review and complete"
      : "Save review";

export const EXTEND_BAR =
  "The extension and its schedule go into the status history.";
export const completedToast = (title: string): string =>
  `Review saved. ${title} is completed.`;
export const extendedToast = (end: string, today: string): string =>
  `Review saved. Extended to ${dayLabel(end, today)}.`;
export const EXTENSION_NOT_MADE = "The extension wasn't made.";
export const MAKE_EXTENSION = "Make the extension";
export const EXTENSION_FAILED = "It still wasn't made. Try again.";
export const extensionMadeToast = (end: string, today: string): string =>
  `Extended to ${dayLabel(end, today)}.`;

// ---------- The saved final review ----------

export type WhatNext =
  | { kind: "completed"; text: string }
  | {
      kind: "extended";
      text: string;
      schedule: string;
      reason: string;
    }
  | { kind: "pending"; text: string }
  | null;

/** What the review decided, and what came of it. */
export function whatNext(
  r: Pick<Review, "id" | "outcome">,
  o: Pick<Objective, "segments">,
  today: string,
): WhatNext {
  if (r.outcome === "completed") {
    return { kind: "completed", text: "Completed with this review" };
  }
  if (r.outcome !== "continued") return null;
  const made = o.segments.find((s) => s.created_by_review_id === r.id);
  if (!made) return { kind: "pending", text: EXTENSION_NOT_MADE };
  return {
    kind: "extended",
    text: `Extended to ${dayLabel(made.end_date, today)}`,
    schedule: `${scheduleLine(made.schedule, duration)} · ${made.review_cadence} reviews`,
    reason: made.reason,
  };
}

/**
 * The saved final review whose extension wasn't made (G49): outcome
 * continued, of the plan as it stands, and named by no segment. Derived,
 * never stored; null when there is none.
 */
export function pendingExtension(
  o: Pick<Objective, "end_date" | "segments">,
  reviews: readonly ReviewSummary[],
): ReviewSummary | null {
  return (
    reviews.find(
      (r) =>
        r.kind === "plan_end" &&
        r.status === "saved" &&
        r.outcome === "continued" &&
        r.period_end === o.end_date &&
        !o.segments.some((s) => s.created_by_review_id === r.id),
    ) ?? null
  );
}
