import type { GeneratedSlot, SegmentForSlots } from "./generateSlots";
import { planSlots, toGeneratedSlot } from "./planSlots";
import type { StatusEventRow } from "./statusTimeline";

/**
 * Which planned slot covers a date, computed rather than looked up (ADR-008).
 *
 * This is the rule `plan_slot` used to hold as rows. It reads `planSlots` —
 * the schedule filtered by the status timeline — NOT a second generator (G-09
 * exists to stop that), and it no longer checks the status itself: pause
 * suppression lives in `planSlots` alone (I-01).
 *
 * ERD invariant 10: a slot exists only for dates inside its segment and only for
 * stretches the objective was active. Pausing suppresses slots for the paused
 * days; resuming produces them again. Effort logged while paused is covered by
 * no slot and therefore counts as extra.
 */

export type SegmentWithRange = SegmentForSlots;

/**
 * The slot covering `date`, or null when nothing plans that day: outside every
 * segment, not a planned weekday, or the objective was not active then.
 *
 * A flexible date is covered by its week slot, on any day of the week the
 * objective was active. A paused day inside that week is covered by nothing,
 * so effort logged on it is extra — the same rule as a fixed schedule.
 */
export function coveringSlot(
  segments: readonly SegmentWithRange[],
  statusEvents: readonly StatusEventRow[],
  date: string,
): GeneratedSlot | null {
  const slot = planSlots(segments, statusEvents).find((s) =>
    s.activeDays.includes(date),
  );
  return slot ? toGeneratedSlot(slot) : null;
}

/**
 * The next date after `date` that the plan asks for, or null if the plan is
 * finished. Used by Today to say "next planned 21 Sep" when nothing is planned
 * for the day being viewed. Inside a flexible week, that is the next active day
 * of the week: any of them may be the one worked.
 */
export function nextPlannedDate(
  segments: readonly SegmentWithRange[],
  statusEvents: readonly StatusEventRow[],
  date: string,
): string | null {
  let soonest: string | null = null;

  for (const slot of planSlots(segments, statusEvents)) {
    const day = slot.activeDays.find((d) => d > date);
    if (day && (soonest === null || day < soonest)) soonest = day;
  }

  return soonest;
}

/**
 * Is the date inside any segment's range? This is the "outside the plan" rule
 * (W3-14): a date inside the range but not a planned weekday is allowed and
 * counts as extra; a date outside every range is refused.
 */
export function isDateInPlan(
  segments: readonly SegmentWithRange[],
  date: string,
): boolean {
  return segments.some((s) => s.startDate <= date && date <= s.endDate);
}
