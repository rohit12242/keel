import { describe, expect, it } from "vitest";
import type { Deviation, Review } from "@/shared/contract";
import {
  answersOf,
  checkReview,
  ERRORS,
  hasChange,
  patchBody,
  REFLECT,
  REFLECT_MAX,
  sameAnswers,
  savedToast,
  toJudge,
  verdictsOf,
  type Answers,
} from "./reviewForm";

const deviation = (over: Partial<Deviation>): Deviation => ({
  id: "d",
  objective_ids: ["o"],
  local_date: "2026-09-02",
  tz: "UTC",
  kind: "chosen",
  what_happened: "w",
  reasoning: "r",
  minutes: 30,
  pattern_id: null,
  pattern_name: null,
  verdict: null,
  verdict_review_id: null,
  pattern_nth: null,
  review_due_on: null,
  ...over,
});

const DEVIATIONS = [
  deviation({ id: "open" }),
  deviation({ id: "mine", verdict: "worth_it", verdict_review_id: "r2" }),
  deviation({ id: "theirs", verdict: "worth_it", verdict_review_id: "rx" }),
  deviation({ id: "drift", kind: "drifted" }),
];

const review = (over: Partial<Review> = {}): Review =>
  ({
    id: "r2",
    deviations: DEVIATIONS,
    previous_what_changes_next: "Hardest first.",
    improvement_answer: null,
    what_worked: null,
    what_got_in_the_way: null,
    what_changes_next: null,
    ...over,
  }) as Review;

const FULL: Answers = {
  improvement_answer: "partly",
  what_worked: "Mornings.",
  what_got_in_the_way: "A cold.",
  what_changes_next: "Start at 9.",
};

describe("the draft's answers", () => {
  it("reads a review into the form and back into a body", () => {
    const empty = answersOf(review());
    expect(empty).toEqual({
      improvement_answer: null,
      what_worked: "",
      what_got_in_the_way: "",
      what_changes_next: "",
    });
    expect(patchBody(empty)).toEqual({
      improvement_answer: null,
      what_worked: null,
      what_got_in_the_way: null,
      what_changes_next: null,
    });
    const back = answersOf(review({ ...FULL }));
    expect(back).toEqual(FULL);
    expect(patchBody(back)).toEqual(FULL);
  });

  it("tells answers apart field by field", () => {
    expect(sameAnswers(FULL, { ...FULL })).toBe(true);
    for (const change of [
      { improvement_answer: "yes" as const },
      { what_worked: "x" },
      { what_got_in_the_way: "x" },
      { what_changes_next: "x" },
    ]) {
      expect(sameAnswers(FULL, { ...FULL, ...change })).toBe(false);
    }
  });

  it("labels Reflect for the review's unit, with the design's limits", () => {
    expect(REFLECT.map((f) => f.label("week"))).toEqual([
      "What worked",
      "What got in the way",
      "What changes next week",
    ]);
    expect(REFLECT[2].label("month")).toBe("What changes next month");
    expect(REFLECT_MAX).toBe(280);
  });
});

describe("what is judged", () => {
  it("asks how the last change went only when there was one", () => {
    expect(hasChange(review())).toBe(true);
    expect(hasChange(review({ previous_what_changes_next: "  " }))).toBe(false);
    expect(hasChange(review({ previous_what_changes_next: null }))).toBe(false);
  });

  it("judges Chosen deviations not judged by another review", () => {
    expect(toJudge(review())).toEqual(["open", "mine"]);
    expect(verdictsOf(review())).toEqual({ open: null, mine: "worth_it" });
  });
});

describe("checkReview", () => {
  it("passes a complete review", () => {
    expect(
      checkReview(FULL, { open: "not_worth_it", mine: "worth_it" }, review()),
    ).toEqual({ ok: true });
  });

  it("finds every problem at once, in page order", () => {
    expect(
      checkReview(
        {
          ...FULL,
          improvement_answer: null,
          what_worked: " ",
          what_got_in_the_way: "",
          what_changes_next: "",
        },
        { open: null, mine: "worth_it" },
        review(),
      ),
    ).toEqual({
      ok: false,
      first: "improvement_answer",
      errors: {
        improvement_answer: ERRORS.improvement_answer,
        "verdict:open": ERRORS.verdict,
        what_worked: ERRORS.what_worked,
        what_got_in_the_way: ERRORS.what_got_in_the_way,
        what_changes_next: ERRORS.what_changes_next,
      },
    });
  });

  it("doesn't ask about a change there wasn't", () => {
    const r = checkReview(
      { ...FULL, improvement_answer: null },
      {},
      review({ previous_what_changes_next: null, deviations: [] }),
    );
    expect(r).toEqual({ ok: true });
    expect(
      checkReview(
        { ...FULL, what_changes_next: "" },
        {},
        review({ deviations: [] }),
      ),
    ).toMatchObject({ first: "what_changes_next" });
  });
});

describe("the toast", () => {
  it("says the review saved, and how many more are due", () => {
    expect(savedToast("Week 2 review", 0)).toBe("Week 2 review saved.");
    expect(savedToast("Week 2 review", 1)).toBe(
      "Week 2 review saved. 1 more due.",
    );
    expect(savedToast("Week 2 review", 2)).toBe(
      "Week 2 review saved. 2 more due.",
    );
  });
});
