import type { ProblemError } from "@/shared/contract";
import { START_TIME } from "./validateWrite";

/**
 * Validate an edit to an effort entry (ADR-001 domain: pure). Every field is
 * optional, but at least one must be there. `local_date` is refused outright:
 * an entry is edited only from the day it belongs to, and a mistake on the
 * wrong day is deleted and logged again (docs/keel-api.yaml).
 */
export type EffortEdit = {
  minutes?: number;
  occurred_at_local?: string;
  note?: string;
  link?: string | null;
};

export type EffortEditResult =
  { ok: true; value: EffortEdit } | { ok: false; errors: ProblemError[] };

export function validateEffortEdit(input: unknown): EffortEditResult {
  const errors: ProblemError[] = [];
  const body =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (!body) {
    return {
      ok: false,
      errors: [{ field: "body", message: "Must be a JSON object." }],
    };
  }

  if ("local_date" in body) {
    errors.push({
      field: "local_date",
      message:
        "Cannot be changed. Delete the entry and log it again on the right day.",
    });
  }

  const value: EffortEdit = {};

  if ("minutes" in body) {
    const m = body.minutes;
    if (typeof m !== "number" || !Number.isInteger(m) || m < 1 || m > 1440) {
      errors.push({
        field: "minutes",
        message: "Must be an integer between 1 and 1440.",
      });
    } else value.minutes = m;
  }

  if ("occurred_at_local" in body) {
    const t = body.occurred_at_local;
    if (typeof t !== "string" || !START_TIME.test(t)) {
      errors.push({
        field: "occurred_at_local",
        message: "HH:MM, 00:00–23:59.",
      });
    } else value.occurred_at_local = t;
  }

  if ("note" in body) {
    const n = body.note;
    if (typeof n !== "string" || n.length < 1 || n.length > 2000) {
      errors.push({ field: "note", message: "1–2000 characters." });
    } else value.note = n;
  }

  if ("link" in body) {
    const l = body.link;
    if (l !== null && (typeof l !== "string" || l.length > 500)) {
      errors.push({
        field: "link",
        message: "Must be a string up to 500 characters, or null.",
      });
    } else value.link = l as string | null;
  }

  if (errors.length > 0) return { ok: false, errors };
  if (Object.keys(value).length === 0) {
    return {
      ok: false,
      errors: [
        {
          field: "body",
          message:
            "Nothing to change: send minutes, occurred_at_local, note or link.",
        },
      ],
    };
  }
  return { ok: true, value };
}
