import { parseIso, toIso } from "@/modules/objectives/domain/generateSlots";
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

/** `date` plus `k` calendar months, clamped to the last day of the target month. */
export function addMonths(date: string, k: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + k;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/**
 * Tile the segment from its start; clip the last window to its end; the last
 * window is the plan-end review, whatever its length.
 */
export function reviewWindows(
  cadence: Cadence,
  segment: SegmentSpan,
): ReviewWindow[] {
  const windows: ReviewWindow[] = [];
  const S = segment.start_date;
  const E = segment.end_date;
  // Each window starts the day after the last one ended, which was before E,
  // so every start is inside the segment; the window that reaches E ends it.
  for (let k = 0; ; k++) {
    const start = cadence === "weekly" ? addDays(S, 7 * k) : addMonths(S, k);
    const natural =
      cadence === "weekly"
        ? addDays(S, 7 * k + 6)
        : addDays(addMonths(S, k + 1), -1);
    const end = natural < E ? natural : E;
    windows.push({
      segment_id: segment.id,
      kind: end === E ? "plan_end" : cadence,
      seq_in_seg: k,
      period_start: start,
      period_end: end,
    });
    if (end === E) break;
  }
  return windows;
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

/** One string per period, for set membership. */
export const periodKey = (w: { period_start: string; period_end: string }) =>
  `${w.period_start}|${w.period_end}`;
