import type { ProblemError } from "@/shared/contract";
import type { ReviewRow } from "./assembleReview";

/**
 * Autosaving a draft review (ADR-001 domain: pure). Every field may be sent,
 * or not; null clears one. The plan-end fields — criteria assessment and
 * verdict, outcome — are for a plan-end review only (invariant 8): sending a
 * value for one on a weekly or monthly review is the contract's 422, not a
 * 400, because the body is well-formed and the review is the wrong kind.
 */
export type ReviewEdit = Partial<
  Pick<
    ReviewRow,
    | "improvement_answer"
    | "improvement_answer_note"
    | "what_worked"
    | "what_got_in_the_way"
    | "what_changes_next"
    | "review_summary"
    | "criteria_assessment"
    | "criteria_verdict"
    | "outcome"
  >
>;

export const PLAN_END_FIELDS = [
  "criteria_assessment",
  "criteria_verdict",
  "outcome",
] as const;

type FieldRule = { text: number } | { oneOf: readonly string[] };

const RULES: Record<keyof ReviewEdit, FieldRule> = {
  improvement_answer: { oneOf: ["yes", "partly", "no"] },
  improvement_answer_note: { text: 2000 },
  what_worked: { text: 4000 },
  what_got_in_the_way: { text: 4000 },
  what_changes_next: { text: 4000 },
  review_summary: { text: 1000 },
  criteria_assessment: { text: 2000 },
  criteria_verdict: { oneOf: ["met", "partly_met", "not_met"] },
  outcome: { oneOf: ["continued", "completed", "paused", "ended"] },
};

export type ReviewEditResult =
  | { ok: true; value: ReviewEdit }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "plan_end_only"; fields: string[] };

export function validateReviewEdit(
  input: unknown,
  kind: ReviewRow["kind"],
): ReviewEditResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      ok: false,
      kind: "invalid",
      errors: [{ field: "body", message: "Must be a JSON object." }],
    };
  }
  const body = input as Record<string, unknown>;
  const errors: ProblemError[] = [];
  const value: Record<string, string | null> = {};
  for (const [field, rule] of Object.entries(RULES)) {
    if (!(field in body)) continue;
    const v = body[field];
    if (v === null) {
      value[field] = null;
    } else if ("text" in rule) {
      if (typeof v === "string" && v.length <= rule.text) value[field] = v;
      else
        errors.push({
          field,
          message: `Up to ${rule.text} characters, or null.`,
        });
    } else if (typeof v === "string" && rule.oneOf.includes(v)) {
      value[field] = v;
    } else {
      errors.push({
        field,
        message: `One of ${rule.oneOf.join(", ")}, or null.`,
      });
    }
  }
  if (errors.length > 0) return { ok: false, kind: "invalid", errors };
  if (kind !== "plan_end") {
    const misplaced = PLAN_END_FIELDS.filter((f) => value[f] != null);
    if (misplaced.length > 0) {
      return { ok: false, kind: "plan_end_only", fields: misplaced };
    }
  }
  return { ok: true, value: value as ReviewEdit };
}
