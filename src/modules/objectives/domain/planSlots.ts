import {
  datesBetween,
  generateSlots,
  type GeneratedSlot,
  type SegmentForSlots,
} from "./generateSlots";
import { statusOn, type StatusEventRow } from "./statusTimeline";

/**
 * The slots the plan actually asks for: the schedule's slots, filtered by the
 * status timeline (ADR-008, ERD invariant 10). This is the one place pause
 * suppression lives — Today, the effort write, the figures and the grid all
 * read it, so they cannot disagree about which days were planned.
 *
 * - A day slot survives only if the objective was active that day.
 * - A week slot keeps only its active days. Its day count is capped by them, so
 *   a week paused for five of its seven days cannot ask for more than two, and
 *   a week with no active day is dropped.
 */
export type PlannedSlot = GeneratedSlot & {
  /** The days inside the slot the objective was active on, in date order. */
  activeDays: string[];
  /** Per-day target: the segment's minutes per planned day. */
  minutesPerDay: number;
};

export function planSlots(
  segments: readonly SegmentForSlots[],
  statusEvents: readonly StatusEventRow[],
): PlannedSlot[] {
  const planned: PlannedSlot[] = [];

  for (const segment of segments) {
    for (const slot of generateSlots(segment)) {
      const activeDays = datesBetween(slot.periodStart, slot.periodEnd).filter(
        (day) => statusOn(statusEvents, day) === "active",
      );
      if (activeDays.length === 0) continue;

      const minutesPerDay = segment.minutesPerPlannedDay;
      if (slot.periodKind === "day") {
        planned.push({ ...slot, activeDays, minutesPerDay });
        continue;
      }

      const targetDays = Math.min(slot.targetDays, activeDays.length);
      planned.push({
        ...slot,
        targetDays,
        targetMinutes: targetDays * minutesPerDay,
        activeDays,
        minutesPerDay,
      });
    }
  }

  return planned;
}

/** The slot as the contract shows it: no active days, no per-day target. */
export function toGeneratedSlot(slot: PlannedSlot): GeneratedSlot {
  // The kind and the day count travel together, so the pair stays well-typed.
  return {
    periodKind: slot.periodKind,
    periodStart: slot.periodStart,
    periodEnd: slot.periodEnd,
    targetMinutes: slot.targetMinutes,
    targetDays: slot.targetDays,
  } as GeneratedSlot;
}
