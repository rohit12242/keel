import type { ProblemError } from "@/shared/contract";
import { err, ok, type Result } from "@/shared/result";
import { isIsoDate } from "@/modules/effort/domain/validateWrite";

/**
 * A note on an objective or a parked idea (ADR-001 domain: pure; G2, G3).
 * Append-only and open in every state, so the only rules are its shape and
 * its date: `written_on` is the day in the user's zone, and a note is written
 * once that day has come.
 */
export type NoteWrite = { written_on: string; text: string };

export function validateNoteWrite(
  input: unknown,
): Result<NoteWrite, ProblemError[]> {
  const body =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: ProblemError[] = [];
  if (typeof body.written_on !== "string" || !isIsoDate(body.written_on)) {
    errors.push({ field: "written_on", message: "Required; YYYY-MM-DD." });
  }
  if (
    typeof body.text !== "string" ||
    body.text.length < 1 ||
    body.text.length > 2000
  ) {
    errors.push({ field: "text", message: "Required; 1–2000 characters." });
  }
  if (errors.length > 0) return err(errors);
  return ok({
    written_on: body.written_on as string,
    text: body.text as string,
  });
}

/** A note dated after today in the caller's zone is refused (the 422). */
export function noteRefusal(writtenOn: string, today: string): "future" | null {
  return writtenOn > today ? "future" : null;
}
