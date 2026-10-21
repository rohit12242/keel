/**
 * Effort is fixed once its day is over (ERD invariant 18; G21). An entry is
 * written only while its `local_date` is today, and edited or deleted only
 * while that is still so — today read in the entry's own zone, never the
 * server's. Pure: the caller supplies today (ADR-001 domain).
 *
 * A closed day cannot change, so a saved review's recomputed figures move
 * only if a rule changes (invariant 14, ADR-008).
 */
export function effortDayRefusal(
  localDate: string,
  today: string,
): "not_today" | null {
  return localDate === today ? null : "not_today";
}
