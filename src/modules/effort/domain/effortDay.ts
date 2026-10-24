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

/**
 * Effort is logged once it has happened: an entry may not end after now, on
 * the clock of the zone it is logged in. A few minutes' grace, so a browser
 * clock a little ahead of the server's still saves what its **Now** filled in.
 * An entry with no start time (written before G29) has no end to judge.
 */
export const FUTURE_GRACE_MINUTES = 5;

const minuteOf = (t: string) =>
  Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function futureRefusal(
  span: { occurred_at_local?: string; minutes: number },
  now: string,
): "in_future" | null {
  if (span.occurred_at_local === undefined) return null;
  const end = minuteOf(span.occurred_at_local) + span.minutes;
  return end > minuteOf(now) + FUTURE_GRACE_MINUTES ? "in_future" : null;
}
