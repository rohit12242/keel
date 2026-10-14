import type { Deviation } from "@/shared/contract";
import type { ReviewRow } from "./assembleReview";

/**
 * A review judging a chosen deviation (ADR-001 domain: pure; invariant 12).
 * Only a chosen deviation, dated inside the review's period, that names the
 * review's objective (422 otherwise). The first review to judge it gives the
 * verdict and no other review changes it (409). The same verdict twice is a
 * no-op. A draft may change its mind; a saved review may not.
 */
export type Verdict = "worth_it" | "not_worth_it";

export type VerdictDecision =
  | { kind: "write" }
  | { kind: "unchanged" }
  | { kind: "not_judgeable"; detail: string }
  | { kind: "judged_elsewhere" }
  | { kind: "review_saved" };

export function verdictDecision(
  review: ReviewRow,
  deviation: Deviation,
  verdict: Verdict,
): VerdictDecision {
  if (deviation.kind !== "chosen") {
    return {
      kind: "not_judgeable",
      detail: "Only a chosen deviation is judged.",
    };
  }
  if (
    deviation.local_date < review.period_start ||
    deviation.local_date > review.period_end
  ) {
    return {
      kind: "not_judgeable",
      detail: "The deviation's date is outside this review's period.",
    };
  }
  if (!deviation.objective_ids.includes(review.objective_id)) {
    return {
      kind: "not_judgeable",
      detail: "The deviation does not name this review's objective.",
    };
  }
  if (
    deviation.verdict_review_id !== null &&
    deviation.verdict_review_id !== review.id
  ) {
    return { kind: "judged_elsewhere" };
  }
  if (deviation.verdict === verdict) return { kind: "unchanged" };
  if (review.status === "saved") return { kind: "review_saved" };
  return { kind: "write" };
}

/** Parse the body: `{ verdict: "worth_it" | "not_worth_it" }`. */
export function parseVerdict(input: unknown): Verdict | null {
  const v =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>).verdict
      : undefined;
  return v === "worth_it" || v === "not_worth_it" ? v : null;
}
