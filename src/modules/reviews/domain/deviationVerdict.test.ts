import { describe, expect, it } from "vitest";
import type { Deviation } from "@/shared/contract";
import type { ReviewRow } from "./assembleReview";
import { parseVerdict, verdictDecision } from "./deviationVerdict";

const review = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  id: "r",
  objective_id: "o",
  kind: "weekly",
  period_start: "2026-09-14",
  period_end: "2026-09-20",
  status: "draft",
  previous_review_id: null,
  improvement_answer: null,
  improvement_answer_note: null,
  what_worked: null,
  what_got_in_the_way: null,
  what_changes_next: null,
  review_summary: null,
  criteria_assessment: null,
  criteria_verdict: null,
  outcome: null,
  saved_at: null,
  ...over,
});
const deviation = (over: Partial<Deviation> = {}): Deviation => ({
  id: "d",
  objective_ids: ["o", "o2"],
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

describe("verdictDecision", () => {
  it("writes a first verdict, and lets a draft change its mind", () => {
    expect(verdictDecision(review(), deviation(), "worth_it")).toEqual({
      kind: "write",
    });
    expect(
      verdictDecision(
        review(),
        deviation({ verdict: "worth_it", verdict_review_id: "r" }),
        "not_worth_it",
      ),
    ).toEqual({ kind: "write" });
  });

  it("is a no-op for the same verdict, even once saved", () => {
    const judged = deviation({ verdict: "worth_it", verdict_review_id: "r" });
    expect(verdictDecision(review(), judged, "worth_it")).toEqual({
      kind: "unchanged",
    });
    expect(
      verdictDecision(review({ status: "saved" }), judged, "worth_it"),
    ).toEqual({
      kind: "unchanged",
    });
  });

  it("refuses to change anything from a saved review", () => {
    expect(
      verdictDecision(review({ status: "saved" }), deviation(), "worth_it"),
    ).toEqual({
      kind: "review_saved",
    });
  });

  it("refuses a deviation another review judged (invariant 12)", () => {
    expect(
      verdictDecision(
        review(),
        deviation({ verdict: "worth_it", verdict_review_id: "other" }),
        "worth_it",
      ),
    ).toEqual({ kind: "judged_elsewhere" });
  });

  it.each([
    [{ kind: "drifted" as const }, /chosen/],
    [{ local_date: "2026-09-13" }, /outside/],
    [{ local_date: "2026-09-21" }, /outside/],
    [{ objective_ids: ["o2"] }, /does not name/],
  ])("refuses %j as not judgeable here", (over, detail) => {
    const d = verdictDecision(review(), deviation(over), "worth_it");
    expect(d.kind).toBe("not_judgeable");
    expect(d.kind === "not_judgeable" && d.detail).toMatch(detail);
  });
});

describe("parseVerdict", () => {
  it("takes the two verdicts and nothing else", () => {
    expect(parseVerdict({ verdict: "worth_it" })).toBe("worth_it");
    expect(parseVerdict({ verdict: "not_worth_it" })).toBe("not_worth_it");
    expect(parseVerdict({ verdict: "maybe" })).toBeNull();
    expect(parseVerdict(null)).toBeNull();
    expect(parseVerdict("worth_it")).toBeNull();
  });
});
