import { previousOf, type ReviewFacts, type ReviewRow } from "./assembleReview";

/**
 * Saving a review (ADR-001 domain: pure). A draft becomes the record. It
 * cannot be saved while a chosen deviation of its period that names its
 * objective is still unjudged — the review is where that judgement is made.
 * The review it answers is fixed at this moment: the most recent saved review
 * that ended before this period began (G-07).
 */
export type SaveDecision =
  | { kind: "save"; previous_review_id: string | null }
  | { kind: "already_saved" }
  | { kind: "unjudged"; deviation_ids: string[] }
  | { kind: "plan_end_not_yet" };

export function saveDecision(
  review: ReviewRow,
  facts: ReviewFacts,
): SaveDecision {
  if (review.status === "saved") return { kind: "already_saved" };
  // I-02 step 27 replaces this: a plan-end review's outcome is applied when
  // it is saved, and that step writes the rule.
  if (review.kind === "plan_end") return { kind: "plan_end_not_yet" };
  const unjudged = facts.deviations
    .filter(
      (d) =>
        d.kind === "chosen" &&
        d.verdict === null &&
        d.local_date >= review.period_start &&
        d.local_date <= review.period_end,
    )
    .map((d) => d.id);
  if (unjudged.length > 0) return { kind: "unjudged", deviation_ids: unjudged };
  return {
    kind: "save",
    previous_review_id: previousOf(review, facts.reviews)?.id ?? null,
  };
}
