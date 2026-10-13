import type { ProblemError } from "@/shared/contract";
import { validatePatternWrite } from "./domain/validatePatternWrite";
import { insertPattern, listPatterns, type PatternRow } from "./repo";

/**
 * deviations/service — one function per use case (ADR-001). Every function
 * takes the signed-in user's id.
 */

export const listDeviationPatterns = (userId: string): Promise<PatternRow[]> =>
  listPatterns(userId);

export type CreatePatternResult =
  | { ok: true; pattern: PatternRow }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "duplicate" };

export async function createDeviationPattern(
  userId: string,
  body: unknown,
): Promise<CreatePatternResult> {
  const validated = validatePatternWrite(body);
  if (!validated.ok) {
    return { ok: false, kind: "invalid", errors: validated.error };
  }
  return insertPattern(userId, validated.value);
}
