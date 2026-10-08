import type {
  DayState,
  ProblemError,
  ScheduleDay,
  ScheduleGrid,
} from "@/shared/contract";
import { err, ok, type Result } from "@/shared/result";
import { isIsoDate } from "@/modules/effort/domain/validateWrite";
import {
  dailyMinutesOf,
  wellFormed,
  type Malformed,
} from "./assembleObjective";
import { datesBetween } from "./generateSlots";
import { planSlots, type PlannedSlot } from "./planSlots";
import { toSegment } from "./segmentRows";
import type { ObjectiveRow } from "./rows";

/**
 * The schedule grid: one row per day, five states (ADR-001 domain: pure).
 * The day-state rule is docs/domain/day-states.md — that file is the
 * authority, `dayState` below is its one implementation.
 *
 * Computed from one read's facts, never a request per day (NFR-03): the
 * planned slots and the minutes logged per date come in; the days go out.
 */

/** The state of one day, given the planned slot covering it (if any). */
export function dayState(
  slot: PlannedSlot | null,
  logged: number,
): { state: DayState; target_minutes: number } {
  if (slot === null) {
    return {
      state: logged > 0 ? "off_day_worked" : "off_day",
      target_minutes: 0,
    };
  }
  const target = slot.minutesPerDay;
  if (logged >= target) return { state: "target_met", target_minutes: target };
  if (logged > 0) return { state: "worked_short", target_minutes: target };
  // Unworked: a fixed day was planned; a flexible day was only available.
  return slot.periodKind === "day"
    ? { state: "planned_no_log", target_minutes: target }
    : { state: "off_day", target_minutes: 0 };
}

export type GridRange = { from?: string; to?: string };

/**
 * The `from` / `to` query parameters: each optional, each a real date, and
 * `to` not before `from`. Refusals are the contract's 400.
 */
export function parseGridRange(
  from: string | null,
  to: string | null,
): Result<GridRange, ProblemError[]> {
  const errors: ProblemError[] = [];
  if (from !== null && !isIsoDate(from)) {
    errors.push({ field: "from", message: "Must be YYYY-MM-DD." });
  }
  if (to !== null && !isIsoDate(to)) {
    errors.push({ field: "to", message: "Must be YYYY-MM-DD." });
  }
  if (errors.length === 0 && from !== null && to !== null && to < from) {
    errors.push({ field: "to", message: "Must not be before from." });
  }
  if (errors.length > 0) return err(errors);
  const range: GridRange = {};
  if (from !== null) range.from = from;
  if (to !== null) range.to = to;
  return ok(range);
}

/**
 * The grid for one objective. The range defaults to the objective's own span
 * and is clamped to it: every day names its segment, and a day outside every
 * segment has none to name. A range entirely outside the plan has no days.
 */
export function assembleGrid(
  row: ObjectiveRow,
  range: GridRange,
): Result<ScheduleGrid, Malformed> {
  const wf = wellFormed(row);
  if (!wf.ok) return wf;
  const { segments } = wf.value;

  const spanStart = segments[0].start_date;
  const spanEnd = segments[segments.length - 1].end_date;
  const from = range.from ?? spanStart;
  const to = range.to ?? spanEnd;
  const first = from > spanStart ? from : spanStart;
  const last = to < spanEnd ? to : spanEnd;

  const slots = planSlots(segments.map(toSegment), row.status_events);
  const logged = dailyMinutesOf(row);
  const days: ScheduleDay[] = [];

  if (first <= last) {
    for (const date of datesBetween(first, last)) {
      const segment = segments.find(
        (s) => s.start_date <= date && date <= s.end_date,
      );
      // Contiguity is enforced by the database (plan_segment_contiguous), so
      // every day of the span has a segment; a gap would be skipped, not named.
      if (!segment) continue;
      const minutes = logged[date] ?? 0;
      const slot = slots.find((s) => s.activeDays.includes(date)) ?? null;
      days.push({
        date,
        ...dayState(slot, minutes),
        segment_id: segment.id,
        logged_minutes: minutes,
      });
    }
  }

  return ok({
    objective_id: row.id,
    from: first <= last ? first : from,
    to: first <= last ? last : to,
    days,
  });
}
