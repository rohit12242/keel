/**
 * plan_segment.planned_weekdays is stored as a bitmask (ERD); the API and
 * generateSlots use an array of ISO weekdays (1 = Monday … 7 = Sunday). These
 * are the single conversion between the two. Pure (ADR-001 domain).
 */
export function weekdaysToBitmask(weekdays: readonly number[]): number {
  return weekdays.reduce((mask, d) => mask | (1 << (d - 1)), 0);
}

export function bitmaskToWeekdays(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 7; d++) {
    if (mask & (1 << (d - 1))) out.push(d);
  }
  return out;
}
