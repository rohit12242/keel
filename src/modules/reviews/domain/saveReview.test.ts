import { describe, expect, it } from "vitest";
import type { Deviation } from "@/shared/contract";
import type { ReviewFacts, ReviewRow } from "./assembleReview";
import { saveDecision } from "./saveReview";

const review = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  id: "r2",
  objective_id: "o",
  kind: "weekly",
  period_start: "2026-09-14",
  period_end: "2026-09-20",
  status: "draft",
  previous_review_id: null,
  improvement_answer: null,
  improvement_answer_note: null,
  what_went_right: null,
  what_needs_improvement: null,
  review_summary: null,
  criteria_assessment: null,
  criteria_verdict: null,
  outcome: null,
  saved_at: null,
  ...over,
});
const deviation = (over: Partial<Deviation>): Deviation => ({
  id: "d",
  objective_ids: ["o"],
  local_date: "2026-09-16",
  tz: "UTC",
  kind: "chosen",
  what_happened: "w",
  reasoning: "r",
  minutes: 30,
  pattern_id: null,
  pattern_name: null,
  verdict: null,
  verdict_review_id: null,
  ...over,
});
const facts = (over: Partial<ReviewFacts> = {}): ReviewFacts => ({
  schedule: [],
  slots: [],
  daily: {},
  reviews: [],
  deviations: [],
  ideas: [],
  ...over,
});

describe("saveDecision", () => {
  it("saves, answering the last saved review before the period", () => {
    const week1 = review({
      id: "r1",
      period_start: "2026-09-07",
      period_end: "2026-09-13",
      status: "saved",
      saved_at: "x",
    });
    expect(saveDecision(review(), facts({ reviews: [week1] }))).toEqual({
      kind: "save",
      previous_review_id: "r1",
    });
    expect(saveDecision(review(), facts())).toEqual({
      kind: "save",
      previous_review_id: null,
    });
  });

  it("refuses while a chosen deviation of the period is unjudged", () => {
    const f = facts({
      deviations: [
        deviation({ id: "open" }),
        deviation({
          id: "judged",
          verdict: "worth_it",
          verdict_review_id: "r2",
        }),
        deviation({ id: "drifted", kind: "drifted" }),
        deviation({ id: "before", local_date: "2026-09-13" }),
        deviation({ id: "after", local_date: "2026-09-21" }),
      ],
    });
    expect(saveDecision(review(), f)).toEqual({
      kind: "unjudged",
      deviation_ids: ["open"],
    });
  });

  it("refuses a review already saved", () => {
    expect(
      saveDecision(review({ status: "saved", saved_at: "x" }), facts()),
    ).toEqual({
      kind: "already_saved",
    });
  });

  it("does not save a plan-end review yet", () => {
    expect(saveDecision(review({ kind: "plan_end" }), facts())).toEqual({
      kind: "plan_end_not_yet",
    });
  });
});
