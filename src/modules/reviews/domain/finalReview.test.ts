import { describe, expect, it } from "vitest";
import type {
  Deviation,
  Objective,
  PlanSegment,
  PlanWeek,
  Review,
  ReviewSummary,
} from "@/shared/contract";
import { extensionSpan } from "@/modules/objectives/domain/validateExtension";
import {
  CRITERIA,
  CRITERIA_ORDER,
  CRITERIA_TONE,
  EXTEND_MAX,
  FINAL_ERRORS,
  OUTCOMES,
  changedFrom,
  checkFinal,
  completedToast,
  criteriaSet,
  extendDraft,
  extendErrors,
  extendPreview,
  extendSpan,
  extendedToast,
  extensionBody,
  extensionMadeToast,
  finalAnswersOf,
  finalPatch,
  isCurrent,
  pendingExtension,
  planHint,
  planRows,
  sameFinal,
  saveLabel,
  whatNext,
  type ExtendDraft,
  type FinalAnswers,
} from "./finalReview";
import { ERRORS } from "./reviewForm";

/** The design's plan: Mon 10 Aug – Fri 4 Sep, Mon–Sat, 2h a day. */
const TODAY = "2026-09-05";
const MON_TO_SAT = [1, 2, 3, 4, 5, 6];

const segment = (over: Partial<PlanSegment> = {}): PlanSegment => ({
  id: "s0",
  seq: 0,
  schedule: {
    mode: "fixed",
    planned_weekdays: MON_TO_SAT,
    minutes_per_planned_day: 120,
    label: "FIXED · MON–SAT · 2h 00m PER DAY",
  },
  start_date: "2026-08-10",
  end_date: "2026-09-04",
  plans_from: "2026-08-10",
  review_cadence: "weekly",
  reason: "Why now.",
  created_by_review_id: null,
  ...over,
});

const objective = (over: Partial<Objective> = {}): Objective =>
  ({
    id: "o",
    title: "Portfolio site rebuild",
    start_date: "2026-08-10",
    end_date: "2026-09-04",
    segments: [segment()],
    status_history: [{ occurred_on: "2026-08-09", change: "created" }],
    ...over,
  }) as Objective;

const week = (start: string, end: string, pct: number): PlanWeek => ({
  period_start: start,
  period_end: end,
  figures: { adherence_pct: pct, logged_minutes: 0, target_minutes: 0 },
});

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

const review = (over: Partial<Review> = {}): Review =>
  ({
    id: "rf",
    kind: "plan_end",
    deviations: [deviation({ id: "open" })],
    previous_what_changes_next: "Hardest first.",
    improvement_answer: null,
    what_worked: null,
    what_got_in_the_way: null,
    what_changes_next: null,
    criteria_verdict: null,
    criteria_assessment: null,
    outcome: null,
    ...over,
  }) as Review;

const summary = (over: Partial<ReviewSummary> = {}): ReviewSummary => ({
  id: "rf",
  kind: "plan_end",
  label: "End of plan",
  period_start: "2026-08-31",
  period_end: "2026-09-04",
  status: "saved",
  saved_at: "2026-09-05T10:00:00Z",
  last_saved_at: "2026-09-05T10:00:00Z",
  outcome: "continued",
  review_summary: null,
  what_changes_next: null,
  adherence_pct: 80,
  ...over,
});

const DRAFT: ExtendDraft = {
  length: "3",
  unit: "weeks",
  weekdays: [1, 2, 4, 5],
  hours: "1",
  minutes: "30",
  cadence: "weekly",
  reason: "Close, but not done.",
};

const FULL: FinalAnswers = {
  improvement_answer: "partly",
  what_worked: "Mornings.",
  what_got_in_the_way: "A cold.",
  what_changes_next: "",
  criteria_verdict: "partly_met",
  criteria_assessment: "Two of three pages.",
  outcome: "completed",
};

describe("the plan in numbers", () => {
  const WEEKS = [
    week("2026-08-10", "2026-08-16", 90),
    week("2026-08-17", "2026-08-23", 70),
    week("2026-08-24", "2026-08-30", 40),
    week("2026-08-31", "2026-09-04", 100),
    week("2026-09-05", "2026-09-11", 0), // an extension's: after the review
  ];

  it("gives one row per plan week to the review's end, a short last chunk by its days", () => {
    expect(planRows(WEEKS, "2026-09-04")).toEqual([
      {
        key: "2026-08-10",
        label: "Week 1",
        pct: 90,
        pctText: "90%",
        tone: "ok",
      },
      {
        key: "2026-08-17",
        label: "Week 2",
        pct: 70,
        pctText: "70%",
        tone: "risk",
      },
      {
        key: "2026-08-24",
        label: "Week 3",
        pct: 40,
        pctText: "40%",
        tone: "behind",
      },
      {
        key: "2026-08-31",
        label: "Mon 31–4",
        pct: 100,
        pctText: "100%",
        tone: "ok",
      },
    ]);
  });

  it("labels a full last week as a week", () => {
    expect(planRows(WEEKS, "2026-08-30").map((r) => r.label)).toEqual([
      "Week 1",
      "Week 2",
      "Week 3",
    ]);
  });

  it("counts the whole plan's days", () => {
    expect(planHint("2026-08-10", "2026-09-04")).toBe("All 26 days");
  });
});

describe("success criteria", () => {
  it("dates the criteria from the objective's creation", () => {
    expect(criteriaSet(objective(), TODAY)).toBe("Set 9 Aug");
    expect(criteriaSet(objective({ status_history: [] }), TODAY)).toBe(
      "Set 10 Aug",
    );
  });

  it("words and tones each verdict, in the design's order", () => {
    expect(CRITERIA_ORDER.map((v) => CRITERIA[v])).toEqual([
      "Met",
      "Partly met",
      "Not met",
    ]);
    expect(CRITERIA_ORDER.map((v) => CRITERIA_TONE[v])).toEqual([
      "ok",
      "risk",
      "behind",
    ]);
  });
});

describe("answers", () => {
  it("reads a draft's answers, with an outcome the page offers", () => {
    expect(finalAnswersOf(review())).toEqual({
      improvement_answer: null,
      what_worked: "",
      what_got_in_the_way: "",
      what_changes_next: "",
      criteria_verdict: null,
      criteria_assessment: "",
      outcome: null,
    });
    expect(
      finalAnswersOf(
        review({
          what_worked: "a",
          what_got_in_the_way: "b",
          what_changes_next: "c",
          criteria_verdict: "met",
          criteria_assessment: "d",
          outcome: "continued",
        }),
      ),
    ).toMatchObject({ what_changes_next: "c", outcome: "continued" });
    expect(finalAnswersOf(review({ outcome: "completed" })).outcome).toBe(
      "completed",
    );
    expect(finalAnswersOf(review({ outcome: "paused" })).outcome).toBeNull();
  });

  it("sends the final review's fields, an empty one as null", () => {
    expect(finalPatch(FULL)).toEqual({
      improvement_answer: "partly",
      what_worked: "Mornings.",
      what_got_in_the_way: "A cold.",
      criteria_verdict: "partly_met",
      criteria_assessment: "Two of three pages.",
      outcome: "completed",
    });
    expect(
      finalPatch({ ...FULL, what_worked: "", criteria_assessment: "" }),
    ).toMatchObject({ what_worked: null, criteria_assessment: null });
  });

  it("compares what autosave would send", () => {
    expect(sameFinal(FULL, { ...FULL })).toBe(true);
    expect(sameFinal(FULL, { ...FULL, outcome: "continued" })).toBe(false);
  });

  it("offers Complete and Extend, in that order", () => {
    expect(OUTCOMES.map((o) => o.title)).toEqual(["Complete it", "Extend it"]);
  });
});

describe("the extension", () => {
  it("fills the fields from the latest segment, for two weeks", () => {
    const o = objective({
      segments: [
        segment({
          seq: 1,
          review_cadence: "monthly",
          schedule: {
            ...segment().schedule,
            planned_weekdays: [5, 1],
            minutes_per_planned_day: 45,
          },
        }),
        segment(),
      ],
    });
    expect(extendDraft(o)).toEqual({
      length: "2",
      unit: "weeks",
      weekdays: [1, 5],
      hours: "0",
      minutes: "45",
      cadence: "monthly",
      reason: "",
    });
  });

  it("fills no days from a flexible segment (v2)", () => {
    const flexible = objective({
      segments: [
        segment({
          schedule: {
            mode: "flexible",
            days_per_week: 3,
            minutes_per_planned_day: 60,
            label: "",
          },
        }),
      ],
    });
    expect(extendDraft(flexible).weekdays).toEqual([]);
  });

  it("knows when the schedule is still the current plan's", () => {
    const o = objective();
    expect(isCurrent(extendDraft(o), o)).toBe(true);
    expect(isCurrent({ ...extendDraft(o), weekdays: [1] }, o)).toBe(false);
    expect(isCurrent({ ...extendDraft(o), minutes: "30" }, o)).toBe(false);
    expect(isCurrent({ ...extendDraft(o), cadence: "monthly" }, o)).toBe(false);
  });

  it("previews an on-time extension from the day after the plan ends", () => {
    expect(extendPreview(objective(), DRAFT, "2026-09-05")).toBe(
      "Sat 5 – Fri 25 Sep · new end Fri 25 Sep",
    );
  });

  it("previews a late extension from today", () => {
    expect(extendPreview(objective(), DRAFT, "2026-09-14")).toBe(
      "Plans from Mon 14 Sep · new end Sun 4 Oct",
    );
  });

  it("shows the dates the server will write, weeks and months, on time and late", () => {
    for (const today of ["2026-09-05", "2026-09-14"]) {
      for (const d of [
        DRAFT,
        { ...DRAFT, length: "2", unit: "months" as const },
      ]) {
        const s = extendSpan(objective(), d, today);
        expect(s).toMatchObject(extensionSpan("2026-09-04", today, s.days));
      }
    }
    expect(
      extendSpan(
        objective(),
        { ...DRAFT, length: "1", unit: "months" },
        "2026-09-14",
      ),
    ).toMatchObject({
      plans_from: "2026-09-14",
      end_date: "2026-10-13",
      days: 30,
    });
    // An empty length still previews, as one.
    expect(extendSpan(objective(), { ...DRAFT, length: "" }, TODAY).days).toBe(
      7,
    );
  });

  it("says what changed from the current plan", () => {
    expect(changedFrom(DRAFT, objective())).toEqual({
      days: "Changed from Mon–Sat · 4 planned days a week",
      target: "was 2h 00m a day",
    });
    const same = extendDraft(objective());
    expect(changedFrom(same, objective())).toEqual({
      days: "6 planned days a week",
      target: null,
    });
    expect(changedFrom({ ...same, weekdays: [3] }, objective()).days).toBe(
      "Changed from Mon–Sat · 1 planned day a week",
    );
  });

  it("builds the request, its days counted from the day it plans", () => {
    expect(extensionBody("rf", objective(), DRAFT, "2026-09-14")).toEqual({
      review_id: "rf",
      extend_by_days: 21,
      reason: "Close, but not done.",
      schedule: {
        mode: "fixed",
        planned_weekdays: [1, 2, 4, 5],
        minutes_per_planned_day: 90,
      },
      review_cadence: "weekly",
    });
  });
});

describe("checks", () => {
  const verdicts = { open: "worth_it" as const };

  it("passes a full Complete", () => {
    expect(checkFinal(FULL, verdicts, review(), DRAFT)).toEqual({ ok: true });
  });

  it("names every problem at once, in page order", () => {
    expect(
      checkFinal(
        {
          ...FULL,
          improvement_answer: null,
          criteria_verdict: null,
          criteria_assessment: " ",
          what_worked: "",
          what_got_in_the_way: "",
          outcome: null,
        },
        {},
        review(),
        DRAFT,
      ),
    ).toEqual({
      ok: false,
      first: "improvement_answer",
      errors: {
        improvement_answer: ERRORS.improvement_answer,
        "verdict:open": ERRORS.verdict,
        criteria_verdict: "Pick where you are against the success criteria.",
        criteria_assessment: "Write what shows it.",
        what_worked: ERRORS.what_worked,
        what_got_in_the_way: ERRORS.what_got_in_the_way,
        outcome: "Pick Complete or Extend.",
      },
    });
  });

  it("asks nothing of a first review with no change to check", () => {
    expect(
      checkFinal(
        { ...FULL, improvement_answer: null },
        {},
        review({ previous_what_changes_next: null, deviations: [] }),
        DRAFT,
      ),
    ).toEqual({ ok: true });
  });

  it("checks the extension only when Extend is chosen", () => {
    const bad: ExtendDraft = {
      ...DRAFT,
      length: "",
      weekdays: [],
      hours: "0",
      minutes: "0",
      reason: " ",
    };
    expect(checkFinal(FULL, verdicts, review(), bad)).toEqual({ ok: true });
    expect(
      checkFinal({ ...FULL, outcome: "continued" }, verdicts, review(), bad),
    ).toEqual({
      ok: false,
      first: "extend_length",
      errors: {
        extend_length: "Enter how long to extend.",
        extend_days: "Pick at least one day.",
        extend_target: "Set a target above zero.",
        extend_reason: "Write why the extra time is worth it.",
      },
    });
    expect(
      checkFinal({ ...FULL, outcome: "continued" }, verdicts, review(), DRAFT),
    ).toEqual({ ok: true });
  });

  it("keeps an extension to 26 weeks or 6 months", () => {
    expect(EXTEND_MAX).toEqual({ weeks: 26, months: 6 });
    expect(extendErrors({ ...DRAFT, length: "26" })).toEqual({});
    expect(extendErrors({ ...DRAFT, length: "27" })).toEqual({
      extend_length: FINAL_ERRORS.extend_too_long,
    });
    expect(extendErrors({ ...DRAFT, length: "6", unit: "months" })).toEqual({});
    expect(extendErrors({ ...DRAFT, length: "7", unit: "months" })).toEqual({
      extend_length: "Keep an extension to six months or less.",
    });
  });
});

describe("words", () => {
  it("names the outcome on the save button", () => {
    expect(saveLabel(null)).toBe("Save review");
    expect(saveLabel("completed")).toBe("Save review and complete");
    expect(saveLabel("continued")).toBe("Save review and extend");
  });

  it("says what was saved", () => {
    expect(completedToast("Portfolio site rebuild")).toBe(
      "Review saved. Portfolio site rebuild is completed.",
    );
    expect(extendedToast("2026-09-25", TODAY)).toBe(
      "Review saved. Extended to Fri 25 Sep.",
    );
    expect(extensionMadeToast("2026-09-25", TODAY)).toBe(
      "Extended to Fri 25 Sep.",
    );
  });
});

describe("the saved final review", () => {
  it("says it completed", () => {
    expect(
      whatNext(review({ outcome: "completed" }), objective(), TODAY),
    ).toEqual({ kind: "completed", text: "Completed with this review" });
  });

  it("says where it extended to, with the extension's schedule and why", () => {
    const o = objective({
      segments: [
        segment(),
        segment({
          id: "s1",
          seq: 1,
          start_date: "2026-09-05",
          end_date: "2026-09-25",
          plans_from: "2026-09-05",
          schedule: {
            mode: "fixed",
            planned_weekdays: [1, 2, 4, 5],
            minutes_per_planned_day: 90,
            label: "",
          },
          reason: "Close, but not done.",
          created_by_review_id: "rf",
        }),
      ],
    });
    expect(whatNext(review({ outcome: "continued" }), o, TODAY)).toEqual({
      kind: "extended",
      text: "Extended to Fri 25 Sep",
      schedule: "Fixed · Mon, Tue, Thu, Fri · 1h 30m a day · weekly reviews",
      reason: "Close, but not done.",
    });
  });

  it("says when the extension wasn't made, and nothing for another outcome", () => {
    expect(
      whatNext(review({ outcome: "continued" }), objective(), TODAY),
    ).toEqual({ kind: "pending", text: "The extension wasn't made." });
    expect(whatNext(review({ outcome: null }), objective(), TODAY)).toBeNull();
  });
});

describe("pendingExtension (G49)", () => {
  it("finds the saved continued final review that no segment names", () => {
    expect(pendingExtension(objective(), [summary()])?.id).toBe("rf");
  });

  it("is null once the extension exists, or for anything else", () => {
    const extended = objective({
      end_date: "2026-09-25",
      segments: [
        segment(),
        segment({ id: "s1", seq: 1, created_by_review_id: "rf" }),
      ],
    });
    expect(pendingExtension(extended, [summary()])).toBeNull();
    for (const over of [
      { outcome: "completed" as const },
      { status: "draft" as const },
      { kind: "weekly" as const },
      { period_end: "2026-08-30" },
    ]) {
      expect(pendingExtension(objective(), [summary(over)])).toBeNull();
    }
    expect(pendingExtension(objective(), [])).toBeNull();
  });
});
