import { currentStatus } from "./statusTimeline";
import type { ObjectiveRow } from "./rows";

/**
 * `committed_minutes_per_week` on the objectives list (ADR-001 domain: pure),
 * as the contract defines it: across the active objectives, from the segment
 * in force today for each — a fixed segment commits its planned weekdays ×
 * minutes per planned day, a flexible one its days per week × minutes.
 * Paused objectives commit nothing, and so does one with no segment in force
 * today: not started yet, or past its end and not yet closed.
 *
 * Counted across every objective, whatever the list is filtered to: the
 * commitment does not change with what is on screen.
 */
export function committedMinutesPerWeek(
  rows: readonly ObjectiveRow[],
  today: string,
): number {
  let total = 0;
  for (const row of rows) {
    if (currentStatus(row.status_events) !== "active") continue;
    const segment = row.segments.find(
      (s) => s.start_date <= today && today <= s.end_date,
    );
    if (!segment) continue;
    const days =
      segment.schedule_mode === "fixed"
        ? bitCount(segment.planned_weekdays ?? 0)
        : (segment.days_per_week ?? 0);
    total += days * segment.minutes_per_planned_day;
  }
  return total;
}

function bitCount(mask: number): number {
  let n = 0;
  for (let m = mask; m > 0; m >>= 1) n += m & 1;
  return n;
}
