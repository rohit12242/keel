/**
 * shared/time — the one place day boundaries live (ADR-001).
 *
 * v1 needs only the simple case: format an instant as the local calendar day
 * for a given IANA zone. The timezone/DST matrix is deferred to v2 (NFR-12),
 * but the boundary logic has exactly one home either way — this folder.
 *
 * Pure: takes values, returns values. No clock is read here; the instant is
 * always passed in.
 */
export function localDayOf(instant: Date, timeZone: string): string {
  // en-CA gives an ISO-shaped YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** The wall clock an instant shows in a zone, "HH:MM", 24-hour. */
export function localTimeOf(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("hour")}:${get("minute")}`;
}
