import type { ProblemError } from "@/shared/contract";
import { err, ok, type Result } from "@/shared/result";

/** A new deviation pattern: a name of 1–120 characters, and an optional description. */
export type PatternWrite = { name: string; description: string | null };

export function validatePatternWrite(
  input: unknown,
): Result<PatternWrite, ProblemError[]> {
  const body =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: ProblemError[] = [];
  const name = typeof body.name === "string" ? body.name.trim() : null;
  if (name === null || name.length < 1 || name.length > 120) {
    errors.push({ field: "name", message: "Required; 1–120 characters." });
  }
  const d = body.description;
  if (
    d !== undefined &&
    d !== null &&
    (typeof d !== "string" || d.length > 2000)
  ) {
    errors.push({ field: "description", message: "Up to 2000 characters." });
  }
  if (errors.length > 0) return err(errors);
  return ok({
    name: name as string,
    description: typeof d === "string" && d.length > 0 ? d : null,
  });
}
