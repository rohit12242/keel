import type { ProblemError } from "@/shared/contract";
import { err, ok, type Result } from "@/shared/result";
import { isIsoDate, isValidTz } from "@/modules/effort/domain/validateWrite";
import { isDateInPlan } from "@/modules/objectives/domain/coveringSlot";
import type { SegmentForSlots } from "@/modules/objectives/domain/generateSlots";
import {
  currentStatus,
  type StatusEventRow,
} from "@/modules/objectives/domain/statusTimeline";

/**
 * Recording a deviation (ADR-001 domain: pure). The shape is the contract's
 * DeviationWrite; the rules are its 422: every objective named must be one
 * that could take effort that day — the caller's, active, with a plan segment
 * covering `local_date` — the date may not be after today in the caller's
 * zone, and a pattern named must be theirs.
 */
export type DeviationWrite = {
  objective_ids: string[];
  local_date: string;
  tz: string;
  kind: "chosen" | "drifted";
  what_happened: string;
  reasoning: string;
  did_instead: string | null;
  minutes: number;
  pattern_id: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (v: unknown, min: number, max: number): v is string =>
  typeof v === "string" && v.length >= min && v.length <= max;

export function validateDeviationWrite(
  input: unknown,
): Result<DeviationWrite, ProblemError[]> {
  const body =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: ProblemError[] = [];
  const fail = (field: string, message: string) =>
    errors.push({ field, message });

  const ids = body.objective_ids;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((id) => typeof id === "string" && UUID.test(id)) ||
    new Set(ids.map((id) => (id as string).toLowerCase())).size !== ids.length
  ) {
    fail("objective_ids", "Required; one or more distinct objective ids.");
  }
  if (typeof body.local_date !== "string" || !isIsoDate(body.local_date)) {
    fail("local_date", "Required; YYYY-MM-DD.");
  }
  if (typeof body.tz !== "string" || !isValidTz(body.tz)) {
    fail("tz", "Required; a valid IANA time zone.");
  }
  if (body.kind !== "chosen" && body.kind !== "drifted") {
    fail("kind", "Required; chosen or drifted.");
  }
  if (!text(body.what_happened, 1, 2000)) {
    fail("what_happened", "Required; 1–2000 characters.");
  }
  if (!text(body.reasoning, 1, 2000)) {
    fail("reasoning", "Required; 1–2000 characters.");
  }
  if (body.did_instead !== undefined && !text(body.did_instead, 0, 2000)) {
    fail("did_instead", "Up to 2000 characters.");
  }
  const m = body.minutes;
  if (typeof m !== "number" || !Number.isInteger(m) || m < 1 || m > 1440) {
    fail("minutes", "Required; an integer from 1 to 1440.");
  }
  const p = body.pattern_id;
  if (
    p !== undefined &&
    p !== null &&
    !(typeof p === "string" && UUID.test(p))
  ) {
    fail("pattern_id", "A pattern id, or null for a one-off.");
  }
  if (errors.length > 0) return err(errors);

  return ok({
    objective_ids: ids as string[],
    local_date: body.local_date as string,
    tz: body.tz as string,
    kind: body.kind as "chosen" | "drifted",
    what_happened: body.what_happened as string,
    reasoning: body.reasoning as string,
    did_instead:
      typeof body.did_instead === "string" && body.did_instead.length > 0
        ? body.did_instead
        : null,
    minutes: m as number,
    pattern_id: typeof p === "string" ? p : null,
  });
}

export type ObjectiveFacts = {
  segments: readonly SegmentForSlots[];
  statusEvents: readonly StatusEventRow[];
};

/**
 * Why a well-formed deviation cannot be recorded, or null when it can.
 * `objectives` holds only the caller's objectives, so an id missing from it is
 * someone else's or nobody's — the same answer either way.
 */
export function deviationRefusal(input: {
  write: DeviationWrite;
  objectives: ReadonlyMap<string, ObjectiveFacts>;
  patternIsTheirs: boolean;
  today: string;
}): string | null {
  const { write, objectives, patternIsTheirs, today } = input;
  if (write.local_date > today) {
    return "local_date is after today; a deviation is recorded once it has happened.";
  }
  for (const id of write.objective_ids) {
    const o = objectives.get(id);
    if (!o) return `Objective ${id} is not one of yours.`;
    if (currentStatus(o.statusEvents) !== "active") {
      return `Objective ${id} is not active.`;
    }
    if (!isDateInPlan(o.segments, write.local_date)) {
      return `Objective ${id} has no plan covering ${write.local_date}.`;
    }
  }
  if (write.pattern_id !== null && !patternIsTheirs) {
    return "The pattern named is not one of yours.";
  }
  return null;
}

export type CostTally = { count: number; minutes: number };

/** The cost by kind across a list of deviations — computed, never stored. */
export function costByKind(
  deviations: readonly { kind: "chosen" | "drifted"; minutes: number }[],
): { chosen: CostTally; drifted: CostTally } {
  const cost = {
    chosen: { count: 0, minutes: 0 },
    drifted: { count: 0, minutes: 0 },
  };
  for (const d of deviations) {
    cost[d.kind].count += 1;
    cost[d.kind].minutes += d.minutes;
  }
  return cost;
}
