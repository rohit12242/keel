import type { ProblemError } from "@/shared/contract";
import { isIsoDate, isValidTz } from "@/modules/effort/domain/validateWrite";
import { generateSlots, parseIso, toIso } from "./generateSlots";

/**
 * Validate a create-objective body (ADR-001 domain: pure). Two kinds of
 * refusal, as `createObjective` in docs/keel-api.yaml declares them:
 *
 * - **invalid (400)** — a field wrong on its own: missing, out of range, a
 *   malformed date, an unknown zone, an empty weekday list. Every such field is
 *   named in `errors`.
 * - **mode mismatch (422)** — a well-formed schedule that contradicts its mode:
 *   weekdays given for a flexible schedule, or a day count for a fixed one.
 * - **fixed only (422)** — a well-formed flexible schedule: v1 plans fixed
 *   objectives only (I-09). Flexible is still parsed, for v2.
 *
 * Both are decided before any write, so a schema constraint never surfaces as
 * a 500. `tz` is validated and passed on but never stored: the objective
 * records only the day it starts (I-01, decision 2). Its one use is dating the
 * take of a parked idea — today, in the zone it is created in (G37).
 */

export type NewSchedule =
  | {
      mode: "fixed";
      planned_weekdays: number[];
      minutes_per_planned_day: number;
    }
  | {
      mode: "flexible";
      days_per_week: number;
      minutes_per_planned_day: number;
    };

export type NewObjective = {
  title: string;
  description: string | null;
  why_now: string;
  success_criteria: string;
  plan_link: string | null;
  review_cadence: "weekly" | "monthly";
  schedule: NewSchedule;
  starts_on: string;
  /** starts_on + runs_for_days − 1: a one-day objective starts and ends together. */
  end_date: string;
  /** Started from a parked idea: taking it is creating this objective. */
  from_parked_idea_id: string | null;
  /** The zone it was declared in. Dates the take; never stored. */
  tz: string;
};

export type ObjectiveWriteResult =
  | { ok: true; value: NewObjective }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "mode_mismatch"; detail: string }
  | { ok: false; kind: "fixed_only"; detail: string };

/** Why a flexible schedule is refused, on a new objective and an extension. */
export const FIXED_ONLY =
  "v1 plans fixed objectives only; a flexible schedule is not accepted.";

const DAY_MS = 86_400_000;

function isText(v: unknown, min: number, max: number): v is string {
  return typeof v === "string" && v.length >= min && v.length <= max;
}

function isIntIn(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function isUri(v: string): boolean {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function validateObjectiveWrite(input: unknown): ObjectiveWriteResult {
  const errors: ProblemError[] = [];
  const fail = (field: string, message: string) =>
    errors.push({ field, message });
  const body = asRecord(input) ?? {};

  if (!isText(body.title, 1, 200)) fail("title", "Required; 1–200 characters.");
  if (body.description !== undefined && !isText(body.description, 0, 4000)) {
    fail("description", "Up to 4000 characters.");
  }
  if (!isText(body.why_now, 1, 4000)) {
    fail("why_now", "Required; 1–4000 characters.");
  }
  if (!isText(body.success_criteria, 1, 2000)) {
    fail("success_criteria", "Required; 1–2000 characters.");
  }
  const link = body.plan_link;
  if (
    link !== undefined &&
    link !== null &&
    !(typeof link === "string" && isUri(link))
  ) {
    fail("plan_link", "Must be a URI, or null.");
  }
  if (typeof body.starts_on !== "string" || !isIsoDate(body.starts_on)) {
    fail("starts_on", "Required; must be YYYY-MM-DD.");
  }
  if (typeof body.tz !== "string" || !isValidTz(body.tz)) {
    fail("tz", "Required; must be a valid IANA time zone.");
  }
  // 366, so twelve months across a 29 February fits (G42). An extension
  // keeps 365.
  if (!isIntIn(body.runs_for_days, 1, 366)) {
    fail("runs_for_days", "Required; an integer from 1 to 366.");
  }
  if (body.review_cadence !== "weekly" && body.review_cadence !== "monthly") {
    fail("review_cadence", "Required; weekly or monthly.");
  }
  // Whether the idea is the caller's and still parked is a fact, checked
  // against the record when the objective is written; here, only its shape.
  const idea = body.from_parked_idea_id;
  if (
    idea !== undefined &&
    idea !== null &&
    !(
      typeof idea === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idea,
      )
    )
  ) {
    fail("from_parked_idea_id", "A parked idea's id, or null.");
  }

  const parsed = parseSchedule(body.schedule);
  errors.push(...parsed.errors);
  const mismatch = parsed.mismatch;

  if (errors.length > 0) return { ok: false, kind: "invalid", errors };
  if (mismatch !== null) {
    return { ok: false, kind: "mode_mismatch", detail: mismatch };
  }

  // Every field is valid from here; the casts restate what was just checked.
  const startsOn = body.starts_on as string;
  const endDate = toIso(
    parseIso(startsOn) + ((body.runs_for_days as number) - 1) * DAY_MS,
  );
  const normalised = normaliseSchedule(body.schedule);
  const missed = missesEveryWeekday(normalised, startsOn, endDate);
  if (missed) return { ok: false, kind: "invalid", errors: [missed] };
  if (normalised.mode === "flexible") {
    return { ok: false, kind: "fixed_only", detail: FIXED_ONLY };
  }

  return {
    ok: true,
    value: {
      title: body.title as string,
      description: (body.description as string | undefined) ?? null,
      why_now: body.why_now as string,
      success_criteria: body.success_criteria as string,
      plan_link: (link as string | null | undefined) ?? null,
      review_cadence: body.review_cadence as "weekly" | "monthly",
      schedule: normalised,
      starts_on: startsOn,
      end_date: endDate,
      from_parked_idea_id: typeof idea === "string" ? idea : null,
      tz: body.tz as string,
    },
  };
}

/**
 * A schedule on its own — shared by a new objective and an extension, which
 * carries its own. Field errors are the 400; a well-formed schedule that
 * contradicts its mode is the mismatch.
 */
export function parseSchedule(input: unknown): {
  errors: ProblemError[];
  mismatch: string | null;
} {
  const errors: ProblemError[] = [];
  const fail = (field: string, message: string) =>
    errors.push({ field, message });
  const schedule = asRecord(input);
  let mismatch: string | null = null;
  if (schedule === null) {
    fail("schedule", "Required.");
  } else {
    if (!isIntIn(schedule.minutes_per_planned_day, 15, 1440)) {
      fail(
        "schedule.minutes_per_planned_day",
        "Required; an integer from 15 to 1440.",
      );
    }
    if (schedule.mode === "fixed") {
      const days = schedule.planned_weekdays;
      if (
        !Array.isArray(days) ||
        days.length === 0 ||
        !days.every((d) => isIntIn(d, 1, 7))
      ) {
        fail(
          "schedule.planned_weekdays",
          "Required for a fixed schedule; one or more weekdays, 1 (Monday) to 7.",
        );
      }
      if (schedule.days_per_week !== undefined) {
        mismatch =
          "A fixed schedule takes planned_weekdays, not days_per_week.";
      }
    } else if (schedule.mode === "flexible") {
      if (!isIntIn(schedule.days_per_week, 1, 7)) {
        fail(
          "schedule.days_per_week",
          "Required for a flexible schedule; an integer from 1 to 7.",
        );
      }
      if (schedule.planned_weekdays !== undefined) {
        mismatch =
          "A flexible schedule takes days_per_week, not planned_weekdays.";
      }
    } else {
      fail("schedule.mode", "Required; fixed or flexible.");
    }
  }
  return { errors, mismatch };
}

/** A schedule that `parseSchedule` accepted, normalised: weekdays sorted, once each. */
export function normaliseSchedule(input: unknown): NewSchedule {
  const s = input as Record<string, unknown>;
  const minutes = s.minutes_per_planned_day as number;
  return s.mode === "fixed"
    ? {
        mode: "fixed",
        planned_weekdays: [...new Set(s.planned_weekdays as number[])].sort(
          (a, b) => a - b,
        ),
        minutes_per_planned_day: minutes,
      }
    : {
        mode: "flexible",
        days_per_week: s.days_per_week as number,
        minutes_per_planned_day: minutes,
      };
}

/**
 * A fixed run that misses every planned weekday (two days, Saturday and
 * Sunday, planning Mondays) commits nothing: there is no real target to
 * record. The refusal, or null when the run plans at least one day.
 */
export function missesEveryWeekday(
  schedule: NewSchedule,
  startDate: string,
  endDate: string,
): ProblemError | null {
  if (schedule.mode !== "fixed") return null;
  const slots = generateSlots({
    scheduleMode: "fixed",
    plannedWeekdays: schedule.planned_weekdays,
    minutesPerPlannedDay: schedule.minutes_per_planned_day,
    startDate,
    endDate,
  });
  return slots.length === 0
    ? {
        field: "schedule.planned_weekdays",
        message: "None of these weekdays falls inside the run.",
      }
    : null;
}
