import type { EffortEntryWrite, ProblemError } from "@/shared/contract";

/**
 * Validate an effort-entry write (ADR-001 domain: pure). `local_date` and `tz`
 * are required and come from the client — the server never derives the day from
 * its own clock (NFR-12). So is the start, `occurred_at_local`: with `minutes`
 * it is the entry's span, and no two of a user's spans on one day overlap
 * (invariant 18, G29). `extra` is never accepted here: it is derived at
 * write/read time, so any client-sent value is simply ignored.
 */

/** A start time on a 24-hour clock, 00:00–23:59. */
export const START_TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** An entry's span: where it starts, and how long it runs. */
export type Span = { occurred_at_local: string; minutes: number };

const startMinute = (t: string) =>
  Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * The first of `others` that `span` overlaps, or null. Spans are
 * [start, start + minutes) in minutes from midnight, compared within the day
 * with no wrap: one ending at 10:00 and one starting at 10:00 do not overlap.
 */
export function overlapping<T extends Span>(
  span: Span,
  others: readonly T[],
): T | null {
  const start = startMinute(span.occurred_at_local);
  const end = start + span.minutes;
  for (const o of others) {
    const oStart = startMinute(o.occurred_at_local);
    if (start < oStart + o.minutes && oStart < end) return o;
  }
  return null;
}

/** "09:20–10:20", for the refusal; an end past midnight reads on the next day's clock. */
export function spanLabel(span: Span): string {
  const end = (startMinute(span.occurred_at_local) + span.minutes) % 1440;
  const hh = String(Math.floor(end / 60)).padStart(2, "0");
  const mm = String(end % 60).padStart(2, "0");
  return `${span.occurred_at_local}–${hh}:${mm}`;
}

export type ValidationResult =
  { ok: true; value: EffortEntryWrite } | { ok: false; errors: ProblemError[] };

/** A real calendar date written YYYY-MM-DD. Shared with the objective write. */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * A required, inclusive date range — `from` and `to`, `to` not before
 * `from`. Each bad field is named. Shared by every read that takes one.
 */
export function parseDateRange(
  from: string | null,
  to: string | null,
):
  | { ok: true; from: string; to: string }
  | { ok: false; errors: ProblemError[] } {
  const errors: ProblemError[] = [];
  if (from === null || !isIsoDate(from)) {
    errors.push({ field: "from", message: "Required; YYYY-MM-DD." });
  }
  if (to === null || !isIsoDate(to)) {
    errors.push({ field: "to", message: "Required; YYYY-MM-DD." });
  }
  if (errors.length === 0 && (to as string) < (from as string)) {
    errors.push({ field: "to", message: "Must not be before from." });
  }
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, from: from as string, to: to as string };
}

/** An IANA zone the runtime recognises. Shared with the objective write. */
export function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateEffortEntryWrite(input: unknown): ValidationResult {
  const errors: ProblemError[] = [];
  const body = (
    typeof input === "object" && input !== null ? input : {}
  ) as Record<string, unknown>;

  const local_date = body.local_date;
  if (typeof local_date !== "string" || !isIsoDate(local_date)) {
    errors.push({
      field: "local_date",
      message: "Required; must be YYYY-MM-DD.",
    });
  }

  const tz = body.tz;
  if (typeof tz !== "string" || tz.trim() === "" || !isValidTz(tz)) {
    errors.push({
      field: "tz",
      message: "Required; must be a valid IANA time zone.",
    });
  }

  const minutes = body.minutes;
  if (
    typeof minutes !== "number" ||
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > 1440
  ) {
    errors.push({
      field: "minutes",
      message: "Must be an integer between 1 and 1440.",
    });
  }

  const note = body.note;
  if (typeof note !== "string" || note.length < 1 || note.length > 2000) {
    errors.push({ field: "note", message: "Required; 1–2000 characters." });
  }

  const occurred = body.occurred_at_local;
  if (typeof occurred !== "string" || !START_TIME.test(occurred)) {
    errors.push({
      field: "occurred_at_local",
      message: "Required; HH:MM, 00:00–23:59.",
    });
  }

  const link = body.link;
  if (link !== undefined && link !== null) {
    if (typeof link !== "string" || link.length > 500) {
      errors.push({
        field: "link",
        message: "Must be a string up to 500 characters.",
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const value: EffortEntryWrite = {
    local_date: local_date as string,
    tz: (tz as string).trim(),
    minutes: minutes as number,
    note: note as string,
    occurred_at_local: occurred as string,
  };
  if (typeof link === "string") value.link = link;
  else if (link === null) value.link = null;

  return { ok: true, value };
}
