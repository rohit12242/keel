import {
  statusChange,
  type ChangeRequest,
} from "@/modules/objectives/domain/statusChange";
import type {
  StatusChange,
  StatusEventRow,
} from "@/modules/objectives/domain/statusTimeline";
import { previousOf, type ReviewFacts, type ReviewRow } from "./assembleReview";

/**
 * Saving a review (ADR-001 domain: pure). A draft becomes the record. It
 * cannot be saved while a chosen deviation of its period that names its
 * objective is still unjudged — the review is where that judgement is made.
 * The review it answers is fixed at this moment: the most recent saved review
 * that ended before this period began (G-07).
 *
 * A plan-end review also decides (invariant 7). It needs its outcome and its
 * criteria verdict, and its outcome is applied, not just recorded: completed,
 * paused or ended writes the matching status event, dated the review's
 * period_end — the plan ended that day, whenever the review was saved — by
 * the same transition rule as any status change. Continued writes none; it
 * authorises one extension.
 */
export type SaveDecision =
  | {
      kind: "save";
      previous_review_id: string | null;
      status_event: { change: StatusChange; occurred_on: string } | null;
    }
  | { kind: "already_saved" }
  | { kind: "refused"; detail: string };

const CHANGE_FOR: Record<"completed" | "paused" | "ended", ChangeRequest> = {
  completed: "complete",
  paused: "pause",
  ended: "end",
};

export function saveDecision(
  review: ReviewRow,
  facts: ReviewFacts,
  statusEvents: readonly StatusEventRow[],
): SaveDecision {
  if (review.status === "saved") return { kind: "already_saved" };

  if (review.kind === "plan_end") {
    const missing = [
      review.outcome === null ? "outcome" : null,
      review.criteria_verdict === null ? "criteria verdict" : null,
    ].filter((m) => m !== null);
    if (missing.length > 0) {
      return {
        kind: "refused",
        detail: `A plan-end review needs its ${missing.join(" and ")}.`,
      };
    }
  }

  const unjudged = facts.deviations.filter(
    (d) =>
      d.kind === "chosen" &&
      d.verdict === null &&
      d.local_date >= review.period_start &&
      d.local_date <= review.period_end,
  );
  if (unjudged.length > 0) {
    return {
      kind: "refused",
      detail: `${unjudged.length} chosen deviation(s) in this period are not judged yet.`,
    };
  }

  let status_event: { change: StatusChange; occurred_on: string } | null = null;
  if (review.kind === "plan_end" && review.outcome !== "continued") {
    const applied = statusChange(statusEvents, {
      change: CHANGE_FOR[review.outcome as "completed" | "paused" | "ended"],
      occurred_on: review.period_end,
      reason: null,
    });
    if (!applied.ok) {
      return {
        kind: "refused",
        detail:
          applied.error.kind === "before_latest"
            ? `The outcome would be dated ${review.period_end}, before the latest status change (${applied.error.latest}).`
            : `The outcome does not follow from the objective's status (${applied.error.from ?? "none"}).`,
      };
    }
    status_event = { change: applied.value, occurred_on: review.period_end };
  }

  return {
    kind: "save",
    previous_review_id: previousOf(review, facts.reviews)?.id ?? null,
    status_event,
  };
}
