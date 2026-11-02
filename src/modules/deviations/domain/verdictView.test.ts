import { describe, expect, it } from "vitest";
import { seenVerdict, type RecordedDeviation } from "./verdictView";

const judged = (over: Partial<RecordedDeviation> = {}): RecordedDeviation => ({
  id: "d",
  objective_ids: ["o"],
  local_date: "2026-09-15",
  tz: "UTC",
  kind: "chosen",
  what_happened: "w",
  reasoning: "r",
  minutes: 30,
  pattern_id: null,
  pattern_name: null,
  verdict: "worth_it",
  verdict_review_id: "r1",
  pattern_nth: null,
  review_due_on: "2026-09-20",
  verdict_saved: false,
  ...over,
});

describe("seenVerdict", () => {
  it("shows a saved review's verdict everywhere", () => {
    for (const inReview of [null, "r1", "r2"]) {
      const d = seenVerdict(judged({ verdict_saved: true }), inReview);
      expect(d.verdict).toBe("worth_it");
      expect(d.verdict_review_id).toBe("r1");
    }
  });

  it("shows a draft's verdict only inside that draft", () => {
    expect(seenVerdict(judged(), "r1").verdict).toBe("worth_it");
    for (const inReview of [null, "r2"]) {
      const d = seenVerdict(judged(), inReview);
      expect(d.verdict).toBeNull();
      expect(d.verdict_review_id).toBeNull();
    }
  });

  it("leaves an unjudged deviation unjudged, and never returns the flag", () => {
    const d = seenVerdict(
      judged({ verdict: null, verdict_review_id: null }),
      null,
    );
    expect(d.verdict).toBeNull();
    expect("verdict_saved" in d).toBe(false);
    expect("verdict_saved" in seenVerdict(judged(), "r1")).toBe(false);
  });
});
