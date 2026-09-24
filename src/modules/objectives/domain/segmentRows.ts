import { bitmaskToWeekdays } from "./weekdays";
import type { SegmentForSlots } from "./generateSlots";

/**
 * A plan segment as the repositories return it, and the one mapping from that
 * row to the value the slot rules take.
 *
 * It lives beside `generateSlots` rather than in a feature's `rows.ts` because
 * both Today and the effort write need it, and a segment belongs to objectives.
 */
export type PlanSegmentRow = {
  seq: number;
  schedule_mode: "fixed" | "flexible";
  /** Bitmask Mon–Sun; null when the segment is flexible. */
  planned_weekdays: number | null;
  days_per_week: number | null;
  minutes_per_planned_day: number;
  start_date: string;
  end_date: string;
};

export function toSegment(row: PlanSegmentRow): SegmentForSlots {
  return {
    scheduleMode: row.schedule_mode,
    plannedWeekdays: bitmaskToWeekdays(row.planned_weekdays ?? 0),
    minutesPerPlannedDay: row.minutes_per_planned_day,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}
