import type { ProblemError } from "@/shared/contract";
import { err, ok, type Result } from "@/shared/result";
import { parseDateRange } from "@/modules/effort/domain/validateWrite";

/**
 * `GET /deviations` parameters: `from` and `to` are required — the client picks
 * the default range (CLAUDE.md, *Not in v1*) — and `objective_id` is optional.
 * An objective id that names nobody's objective simply matches nothing.
 */
export type DeviationQuery = {
  from: string;
  to: string;
  objectiveId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseDeviationQuery(
  from: string | null,
  to: string | null,
  objectiveId: string | null,
): Result<DeviationQuery, ProblemError[]> {
  const range = parseDateRange(from, to);
  const errors: ProblemError[] = range.ok ? [] : [...range.errors];
  if (objectiveId !== null && !UUID.test(objectiveId)) {
    errors.push({ field: "objective_id", message: "Must be an objective id." });
  }
  if (errors.length > 0) return err(errors);
  return ok({ from: from as string, to: to as string, objectiveId });
}
