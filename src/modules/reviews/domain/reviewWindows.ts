import { parseIso, toIso } from "@/modules/objectives/domain/generateSlots";
import { mondayOf } from "@/modules/effort/domain/effortMonth";
import type { PlannedSlot } from "@/modules/objectives/domain/planSlots";
import type { ObjectiveStatus } from "@/modules/objectives/domain/statusTimeline";

/**
 * The review windows of an objective (ADR-001 domain: pure). The rule is
 * docs/domain/review-windows.md; this file is its one implementation.
 *
 * Nothing here is stored. A window is a function of the segment's dates and
 * the cadence; which one is due is a separate predicate over today, the
 * status and the saved reviews.
 */
export type Cadence = "weekly" | "monthly";
export type WindowKind = "weekly" | "monthly" | "plan_end";

export type ReviewWindow = {
  segment_id: string;
  kind: WindowKind;
  /** 0-based, the order within the segment. */
  seq_in_seg: number;
  period_start: string;
  /** Inclusive. Also the window's due date. */
  period_end: string;
};

export type SegmentSpan = { id: string; start_date: string; end_date: string };

const DAY = 86_400_000;
const addDays = (date: string, n: number) => toIso(parseIso(date) + n * DAY);

/**
 * `date` plus `k` calendar months, clamped to the last day of the target
 * month. Not a window rule: New objective uses it for how long *n* months runs.
 */
export function addMonths(date: string, k: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + k;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** A period shorter than this joins its neighbour: under half a full one. */
const SHORT: Record<Cadence, number> = { weekly: 4, monthly: 15 };

/** The last day of the calendar period `date` falls in: its Sunday, or its month's last day. */
function periodEnd(cadence: Cadence, date: string): string {
  if (cadence === "weekly") return addDays(mondayOf(date), 6);
  const [y, m] = date.split("-").map(Number);
  return toIso(Date.UTC(y, m, 0));
}

const length = (p: { start: string; end: string }) =>
  (parseIso(p.end) - parseIso(p.start)) / DAY + 1;

/**
 * The calendar periods — Monday-to-Sunday weeks, or calendar months — that
 * overlap the segment, clipped to it. A short first period joins the one
 * after it, a short last one the one before. The last window is the plan-end
 * review, whatever its length.
 */
export function reviewWindows(
  cadence: Cadence,
  segment: SegmentSpan,
): ReviewWindow[] {
  const E = segment.end_date;
  const periods: { start: string; end: string }[] = [];
  for (let start = segment.start_date; start <= E;) {
    const natural = periodEnd(cadence, start);
    const end = natural < E ? natural : E;
    periods.push({ start, end });
    start = addDays(end, 1);
  }
  if (periods.length > 1 && length(periods[0]) < SHORT[cadence]) {
    const [first, second] = periods.splice(0, 2);
    periods.unshift({ start: first.start, end: second.end });
  }
  const n = periods.length;
  if (n > 1 && length(periods[n - 1]) < SHORT[cadence]) {
    const [before, last] = periods.splice(n - 2, 2);
    periods.push({ start: before.start, end: last.end });
  }
  return periods.map((p, k) => ({
    segment_id: segment.id,
    kind: p.end === E ? "plan_end" : cadence,
    seq_in_seg: k,
    period_start: p.start,
    period_end: p.end,
  }));
}

export type LabelledWindow = ReviewWindow & { label: string };

/**
 * Every window of the objective, segment after segment. Labels run on across
 * an extension — Week 1 … Week 3, End of plan, Week 4 … — and each segment
 * keeps its own End of plan.
 */
export function reviewSchedule(
  cadence: Cadence,
  segments: readonly SegmentSpan[],
): LabelledWindow[] {
  const out: LabelledWindow[] = [];
  let n = 0;
  for (const segment of segments) {
    for (const w of reviewWindows(cadence, segment)) {
      if (w.kind === "plan_end") {
        out.push({ ...w, label: "End of plan" });
      } else {
        n += 1;
        out.push({
          ...w,
          label: `${cadence === "weekly" ? "Week" : "Month"} ${n}`,
        });
      }
    }
  }
  return out;
}

/** How many days in the window the plan asked for, after pauses. */
export function plannedDaysIn(
  window: { period_start: string; period_end: string },
  slots: readonly PlannedSlot[],
): number {
  let days = 0;
  for (const s of slots) {
    for (const d of s.activeDays) {
      if (d >= window.period_start && d <= window.period_end) days += 1;
    }
  }
  return days;
}

/**
 * The windows that are due, earliest first: closed (today on or after its
 * period_end), not saved, with at least one planned day — and only while the
 * objective is active. `next_review_on` is the first one's period_end;
 * `reviews_due` is how many there are.
 */
export function dueWindows<W extends ReviewWindow>(input: {
  schedule: readonly W[];
  today: string;
  status: ObjectiveStatus | null;
  saved: ReadonlySet<string>;
  slots: readonly PlannedSlot[];
}): W[] {
  if (input.status !== "active") return [];
  return input.schedule.filter(
    (w) =>
      input.today >= w.period_end &&
      !input.saved.has(periodKey(w)) &&
      plannedDaysIn(w, input.slots) > 0,
  );
}

/**
 * The next review, due or not (G34): the period_end of the earliest window
 * without a saved review. A window that has closed with no planned day is
 * skipped — it can never become due. Null once none is left, and once the
 * objective is completed or ended; a paused one still has one.
 */
export function upcomingReviewOn(input: {
  schedule: readonly ReviewWindow[];
  today: string;
  status: ObjectiveStatus | null;
  saved: ReadonlySet<string>;
  slots: readonly PlannedSlot[];
}): string | null {
  if (input.status !== "active" && input.status !== "paused") return null;
  const next = input.schedule.find(
    (w) =>
      !input.saved.has(periodKey(w)) &&
      !(input.today >= w.period_end && plannedDaysIn(w, input.slots) === 0),
  );
  return next ? next.period_end : null;
}

/**
 * The review that will judge something dated `date`: the earliest period_end
 * among the windows, across the objectives, whose period contains it (G33).
 * Saved or not does not matter — it names the review the date falls in.
 * Null when no window covers the date.
 */
export function reviewDueOn(
  date: string,
  objectives: readonly {
    cadence: Cadence;
    segments: readonly SegmentSpan[];
  }[],
): string | null {
  let due: string | null = null;
  for (const o of objectives) {
    for (const w of reviewSchedule(o.cadence, o.segments)) {
      if (w.period_start <= date && date <= w.period_end) {
        if (due === null || w.period_end < due) due = w.period_end;
      }
    }
  }
  return due;
}

/** One string per period, for set membership. */
export const periodKey = (w: { period_start: string; period_end: string }) =>
  `${w.period_start}|${w.period_end}`;
