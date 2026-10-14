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

const ACTIVE = [{ occurred_on: "2026-09-07", change: "created" as const }];

describe("saveDecision", () => {
  it("saves, answering the last saved review before the period", () => {
    const week1 = review({
      id: "r1",
      period_start: "2026-09-07",
      period_end: "2026-09-13",
      status: "saved",
      saved_at: "x",
    });
    expect(saveDecision(review(), facts({ reviews: [week1] }), ACTIVE)).toEqual(
      {
        kind: "save",
        previous_review_id: "r1",
        status_event: null,
      },
    );
    expect(saveDecision(review(), facts(), ACTIVE)).toEqual({
      kind: "save",
      previous_review_id: null,
      status_event: null,
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
    expect(saveDecision(review(), f, ACTIVE)).toEqual({
      kind: "refused",
      detail: "1 chosen deviation(s) in this period are not judged yet.",
    });
  });

  it("refuses a review already saved", () => {
    expect(
      saveDecision(review({ status: "saved", saved_at: "x" }), facts(), ACTIVE),
    ).toEqual({
      kind: "already_saved",
    });
  });

  const planEnd = (over: Partial<ReviewRow> = {}) =>
    review({
      kind: "plan_end",
      period_start: "2026-10-05",
      period_end: "2026-10-11",
      outcome: "completed",
      criteria_verdict: "partly_met",
      ...over,
    });

  it("refuses a plan-end review without its outcome or its criteria verdict", () => {
    expect(saveDecision(planEnd({ outcome: null }), facts(), ACTIVE)).toEqual({
      kind: "refused",
      detail: "A plan-end review needs its outcome.",
    });
    expect(
      saveDecision(
        planEnd({ outcome: null, criteria_verdict: null }),
        facts(),
        ACTIVE,
      ),
    ).toEqual({
      kind: "refused",
      detail: "A plan-end review needs its outcome and criteria verdict.",
    });
  });

  it.each([
    ["completed", "completed"],
    ["paused", "paused"],
    ["ended", "ended"],
  ] as const)(
    "applies %s as a status event dated period_end",
    (outcome, change) => {
      expect(saveDecision(planEnd({ outcome }), facts(), ACTIVE)).toMatchObject(
        {
          kind: "save",
          status_event: { change, occurred_on: "2026-10-11" },
        },
      );
    },
  );

  it("writes no status event for continued", () => {
    expect(
      saveDecision(planEnd({ outcome: "continued" }), facts(), ACTIVE),
    ).toMatchObject({
      kind: "save",
      status_event: null,
    });
  });

  it("refuses an outcome that does not follow, or would rewrite the history", () => {
    const ended = [
      ...ACTIVE,
      { occurred_on: "2026-10-01", change: "ended" as const },
    ];
    expect(saveDecision(planEnd(), facts(), ended)).toMatchObject({
      kind: "refused",
      detail: expect.stringMatching(/does not follow/),
    });
    const pausedLater = [
      ...ACTIVE,
      { occurred_on: "2026-10-20", change: "paused" as const },
    ];
    expect(
      saveDecision(planEnd({ outcome: "ended" }), facts(), pausedLater),
    ).toMatchObject({
      kind: "refused",
      detail: expect.stringMatching(
        /before the latest status change \(2026-10-20\)/,
      ),
    });
    expect(saveDecision(planEnd(), facts(), [])).toMatchObject({
      detail: expect.stringMatching(/\(none\)/),
    });
  });
});
