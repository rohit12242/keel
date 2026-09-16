import type { EffortEntryWrite, ProblemError } from "@/shared/contract";

/**
 * Validate an effort-entry write (ADR-001 domain: pure). `local_date` and `tz`
 * are required and come from the client — the server never derives the day from
 * its own clock (NFR-12). `extra` is never accepted here: it is derived at
 * write/read time, so any client-sent value is simply ignored.
 */

export type ValidationResult =
  { ok: true; value: EffortEntryWrite } | { ok: false; errors: ProblemError[] };

function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function isValidTz(tz: string): boolean {
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
  if (occurred !== undefined) {
    if (
      typeof occurred !== "string" ||
      !/^[0-2][0-9]:[0-5][0-9]$/.test(occurred)
    ) {
      errors.push({ field: "occurred_at_local", message: "Must be HH:MM." });
    }
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
  };
  if (typeof occurred === "string") value.occurred_at_local = occurred;
  if (typeof link === "string") value.link = link;
  else if (link === null) value.link = null;

  return { ok: true, value };
}
