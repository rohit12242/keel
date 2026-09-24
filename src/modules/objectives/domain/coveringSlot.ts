import {
  generateSlots,
  type GeneratedSlot,
  type SegmentForSlots,
} from "./generateSlots";
import { statusOn, type StatusEventRow } from "./statusTimeline";

/**
 * Which planned slot covers a date, computed rather than looked up (ADR-008).
 *
 * This is the rule `plan_slot` used to hold as rows. It is `generateSlots`
 * filtered by the status timeline — NOT a second generator (G-09 exists to stop
 * that), so a fix to `generateSlots` reaches this and the New objective preview
 * at once.
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
 * Flexible (week) segments yield null for now. `generateSlots` implements fixed
 * schedules only, and week rows arrive with their own story (E-02) — returning
 * null keeps a deployed endpoint answering `slot: null`, which the contract
 * already allows, rather than throwing on a shape nothing can create yet.
 */
export function coveringSlot(
  segments: readonly SegmentWithRange[],
  statusEvents: readonly StatusEventRow[],
  date: string,
): GeneratedSlot | null {
  if (statusOn(statusEvents, date) !== "active") return null;

  for (const segment of segments) {
    if (segment.scheduleMode !== "fixed") continue;
    if (date < segment.startDate || date > segment.endDate) continue;
    const slot = generateSlots(segment).find(
      (s) => s.periodStart <= date && date <= s.periodEnd,
    );
    if (slot) return slot;
  }
  return null;
}

/**
 * The next date after `date` that the plan asks for, or null if the plan is
 * finished. Used by Today to say "next planned 21 Sep" when nothing is planned
 * for the day being viewed.
 */
export function nextPlannedDate(
  segments: readonly SegmentWithRange[],
  statusEvents: readonly StatusEventRow[],
  date: string,
): string | null {
  let soonest: string | null = null;

  for (const segment of segments) {
    if (segment.scheduleMode !== "fixed") continue;
    if (segment.endDate <= date) continue;
    for (const slot of generateSlots(segment)) {
      if (slot.periodStart <= date) continue;
      if (statusOn(statusEvents, slot.periodStart) !== "active") continue;
      if (soonest === null || slot.periodStart < soonest) {
        soonest = slot.periodStart;
      }
      break; // slots are generated in date order, so the first is this segment's soonest
    }
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
