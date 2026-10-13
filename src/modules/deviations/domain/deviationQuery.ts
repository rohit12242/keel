import type { ProblemError } from "@/shared/contract";
import { err, ok, type Result } from "@/shared/result";
import { isIsoDate } from "@/modules/effort/domain/validateWrite";

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
  if (objectiveId !== null && !UUID.test(objectiveId)) {
    errors.push({ field: "objective_id", message: "Must be an objective id." });
  }
  if (errors.length > 0) return err(errors);
  return ok({ from: from as string, to: to as string, objectiveId });
}
