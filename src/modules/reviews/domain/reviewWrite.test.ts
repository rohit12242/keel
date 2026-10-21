import { describe, expect, it } from "vitest";
import { validateReviewEdit } from "./reviewWrite";

describe("validateReviewEdit", () => {
  it("takes any answers, and null to clear one", () => {
    expect(
      validateReviewEdit(
        {
          improvement_answer: "partly",
          improvement_answer_note: "Mornings only.",
          what_worked: "Showed up.",
          what_changes_next: null,
          review_summary: "A steady week.",
        },
        "weekly",
      ),
    ).toEqual({
      ok: true,
      value: {
        improvement_answer: "partly",
        improvement_answer_note: "Mornings only.",
        what_worked: "Showed up.",
        what_changes_next: null,
        review_summary: "A steady week.",
      },
    });
    expect(validateReviewEdit({}, "weekly")).toEqual({ ok: true, value: {} });
  });

  it("takes not_tried, which is not the same answer as no", () => {
    expect(
      validateReviewEdit({ improvement_answer: "not_tried" }, "weekly"),
    ).toEqual({ ok: true, value: { improvement_answer: "not_tried" } });
  });

  it("takes the plan-end fields on a plan-end review", () => {
    expect(
      validateReviewEdit(
        {
          criteria_assessment: "Two of three.",
          criteria_verdict: "partly_met",
          outcome: "continued",
        },
        "plan_end",
      ),
    ).toMatchObject({ ok: true, value: { outcome: "continued" } });
  });

  it("refuses a plan-end field with a value on any other review, and allows clearing it", () => {
    expect(
      validateReviewEdit(
        { outcome: "completed", criteria_verdict: "met" },
        "monthly",
      ),
    ).toEqual({
      ok: false,
      kind: "plan_end_only",
      fields: ["criteria_verdict", "outcome"],
    });
    expect(validateReviewEdit({ outcome: null }, "weekly")).toEqual({
      ok: true,
      value: { outcome: null },
    });
  });

  it("names each malformed field", () => {
    const r = validateReviewEdit(
      {
        improvement_answer: "maybe",
        review_summary: "s".repeat(1001),
        outcome: 3,
      },
      "plan_end",
    );
    expect(
      r.ok ? [] : r.kind === "invalid" ? r.errors.map((e) => e.field) : [],
    ).toEqual(["improvement_answer", "review_summary", "outcome"]);
  });

  it("refuses a body that is not an object", () => {
    for (const bad of [null, "x", [1]]) {
      expect(validateReviewEdit(bad, "weekly")).toMatchObject({
        ok: false,
        kind: "invalid",
      });
    }
  });
});
