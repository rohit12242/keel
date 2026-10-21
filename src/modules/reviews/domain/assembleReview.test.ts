import { describe, expect, it } from "vitest";
import type { Deviation } from "@/shared/contract";
import { planSlots } from "@/modules/objectives/domain/planSlots";
import type { SegmentForSlots } from "@/modules/objectives/domain/generateSlots";
import type { IdeaRow } from "@/modules/parking/domain/parking";
import {
  assembleReview,
  ideaAsOf,
  previousOf,
  startDecision,
  summaryOf,
  windowFigures,
  type ReviewFacts,
  type ReviewRow,
} from "./assembleReview";
import { reviewSchedule } from "./reviewWindows";

// Mon/Wed/Fri, an hour a day, Mon 7 Sep … Sun 27 Sep: Week 1, Week 2, End of plan.
const PLAN: SegmentForSlots = {
  scheduleMode: "fixed",
  plannedWeekdays: [1, 3, 5],
  minutesPerPlannedDay: 60,
  startDate: "2026-09-07",
  endDate: "2026-09-27",
};
const SLOTS = planSlots(
  [PLAN],
  [{ occurred_on: "2026-09-07", change: "created" }],
);
const SCHEDULE = reviewSchedule("weekly", [
  { id: "s0", start_date: "2026-09-07", end_date: "2026-09-27" },
]);

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

const deviation = (local_date: string): Deviation => ({
  id: `d-${local_date}`,
  objective_ids: ["o"],
  local_date,
  tz: "UTC",
  kind: "chosen",
  what_happened: "w",
  reasoning: "r",
  minutes: 30,
  pattern_id: null,
  pattern_name: null,
  verdict: null,
  verdict_review_id: null,
});

const idea = (caught_on: string, over: Partial<IdeaRow> = {}): IdeaRow => ({
  id: `i-${caught_on}`,
  idea: "x",
  why: "y",
  caught_on,
  locked_until: "2026-09-27",
  verdicts: [{ verdict: "parked", note: null, occurred_on: caught_on }],
  became_objective_id: null,
  ...over,
});

const week1Saved = review({
  id: "r1",
  period_start: "2026-09-07",
  period_end: "2026-09-13",
  status: "saved",
  saved_at: "2026-09-13T10:00:00Z",
  what_changes_next: "Start earlier.",
});

const facts = (over: Partial<ReviewFacts> = {}): ReviewFacts => ({
  schedule: SCHEDULE,
  slots: SLOTS,
  daily: {
    "2026-09-14": 60,
    "2026-09-16": 30,
    "2026-09-19": 20,
    "2026-09-21": 60,
  },
  reviews: [week1Saved],
  deviations: [deviation("2026-09-15"), deviation("2026-09-22")],
  ideas: [idea("2026-09-16"), idea("2026-09-05")],
  ...over,
});

describe("windowFigures", () => {
  it("counts only the window's planned days and minutes", () => {
    expect(windowFigures(review(), SLOTS, facts().daily)).toEqual({
      adherence_pct: 50, // (60 + 30) of 180
      logged_minutes: 110,
      target_minutes: 180,
      planned_days: 3,
      planned_days_worked: 2,
      target_met_days: 1,
      extra_off_day_minutes: 20, // Saturday
      over_target_minutes: 0,
      planned_weeks: 0,
      target_met_weeks: 0,
    });
  });
});

describe("windowFigures — the sum (adherence.md rule 7)", () => {
  // Credited over the slots that start in the window, on the window's days.
  const credited = (
    window: { period_start: string; period_end: string },
    slots: typeof SLOTS,
    daily: Record<string, number>,
  ) =>
    slots
      .filter(
        (s) =>
          s.periodStart >= window.period_start &&
          s.periodStart <= window.period_end,
      )
      .reduce((sum, s) => {
        const inSlot = s.activeDays.reduce((t, d) => t + (daily[d] ?? 0), 0);
        return sum + Math.min(inSlot, s.targetMinutes);
      }, 0);

  const inside = (
    window: { period_start: string; period_end: string },
    daily: Record<string, number>,
  ) =>
    Object.entries(daily)
      .filter(([d]) => d >= window.period_start && d <= window.period_end)
      .reduce((sum, [, m]) => sum + m, 0);

  it("holds for a fixed weekly window, with a long day and an off day", () => {
    const daily = { ...facts().daily, "2026-09-18": 150 };
    const f = windowFigures(review(), SLOTS, daily);
    expect(f.logged_minutes).toBe(inside(review(), daily));
    expect(f.logged_minutes).toBe(
      credited(review(), SLOTS, daily) +
        f.over_target_minutes +
        f.extra_off_day_minutes,
    );
    expect(f.over_target_minutes).toBe(90);
  });

  it("holds for a flexible weekly window, whose week slot starts with it", () => {
    const slots = planSlots(
      [
        {
          scheduleMode: "flexible",
          plannedWeekdays: [],
          daysPerWeek: 3,
          minutesPerPlannedDay: 60,
          startDate: "2026-09-07",
          endDate: "2026-09-27",
        },
      ],
      [{ occurred_on: "2026-09-07", change: "created" }],
    );
    const daily = {
      "2026-09-14": 90,
      "2026-09-15": 60,
      "2026-09-16": 60,
      "2026-09-17": 30,
    };
    const f = windowFigures(review(), slots, daily);
    expect(f.logged_minutes).toBe(
      credited(review(), slots, daily) +
        f.over_target_minutes +
        f.extra_off_day_minutes,
    );
    expect(f).toMatchObject({
      over_target_minutes: 60,
      planned_weeks: 1,
      target_met_weeks: 1,
    });
  });
});

describe("assembleReview", () => {
  it("computes the period's figures, bars, deviations and ideas, and quotes the last review", () => {
    const r = assembleReview(review(), facts());
    expect(r).toMatchObject({
      label: "Week 2",
      due_on: "2026-09-20",
      previous_review_id: "r1",
      previous_what_changes_next: "Start earlier.",
      adherence_pct: 50,
    });
    expect(r.minutes_per_day.slice(0, 3)).toEqual([
      { date: "2026-09-14", minutes: 60, planned: true },
      { date: "2026-09-15", minutes: 0, planned: false },
      { date: "2026-09-16", minutes: 30, planned: true },
    ]);
    expect(r.minutes_per_day).toHaveLength(7);
    expect(r.deviations.map((d) => d.local_date)).toEqual(["2026-09-15"]);
    expect(r.parked_ideas.map((i) => i.caught_on)).toEqual(["2026-09-16"]);
  });

  it("has nothing to quote for the first review of the plan", () => {
    expect(
      assembleReview(
        review({
          id: "r1",
          period_start: "2026-09-07",
          period_end: "2026-09-13",
        }),
        facts({ reviews: [] }),
      ),
    ).toMatchObject({
      label: "Week 1",
      previous_review_id: null,
      previous_what_changes_next: null,
    });
  });

  it("labels the last window End of plan, and a period off the schedule by its kind", () => {
    expect(
      summaryOf(
        review({
          kind: "plan_end",
          period_start: "2026-09-21",
          period_end: "2026-09-27",
        }),
        facts(),
      ).label,
    ).toBe("End of plan");
    expect(
      summaryOf(
        review({ period_start: "2026-09-15", period_end: "2026-09-21" }),
        facts(),
      ).label,
    ).toBe("weekly");
    expect(
      summaryOf(
        review({
          kind: "plan_end",
          period_start: "2026-09-15",
          period_end: "2026-09-21",
        }),
        facts(),
      ).label,
    ).toBe("End of plan");
  });
});

describe("previousOf", () => {
  it("is the stored one once saved, and the latest saved one before for a draft", () => {
    const week2Saved = review({
      status: "saved",
      saved_at: "x",
      previous_review_id: "r1",
    });
    expect(previousOf(week2Saved, [week1Saved])?.id).toBe("r1");
    expect(
      previousOf(review({ status: "saved", previous_review_id: null }), [
        week1Saved,
      ]),
    ).toBeNull();
    const plan = review({
      id: "r3",
      period_start: "2026-09-21",
      period_end: "2026-09-27",
    });
    expect(previousOf(plan, [week1Saved, week2Saved])?.id).toBe("r2");
    expect(previousOf(plan, [week2Saved, week1Saved])?.id).toBe("r2");
    // A draft in between is skipped: only saved reviews are quoted back.
    expect(previousOf(plan, [week1Saved, review()])?.id).toBe("r1");
    expect(previousOf(review(), [])).toBeNull();
  });
});

describe("ideaAsOf", () => {
  it("shows the verdict as it stood at period end, and the objective only once taken", () => {
    const row = idea("2026-09-16", {
      verdicts: [
        { verdict: "parked", note: null, occurred_on: "2026-09-16" },
        { verdict: "taken", note: null, occurred_on: "2026-09-25" },
      ],
      became_objective_id: "o2",
    });
    expect(ideaAsOf(row, "2026-09-20")).toMatchObject({
      verdict: "parked",
      became_objective_id: null,
      locked: true,
    });
    expect(ideaAsOf(row, "2026-09-27")).toMatchObject({
      verdict: "taken",
      became_objective_id: "o2",
      locked: false,
    });
  });
});

describe("startDecision", () => {
  const decide = (over: Partial<Parameters<typeof startDecision>[0]> = {}) =>
    startDecision({
      request: null,
      schedule: SCHEDULE,
      reviews: [],
      slots: SLOTS,
      status: "active",
      today: "2026-09-30",
      ...over,
    });

  it("with no period, creates the earliest due window", () => {
    expect(decide()).toMatchObject({
      kind: "create",
      window: { label: "Week 1" },
    });
    expect(decide({ reviews: [week1Saved] })).toMatchObject({
      kind: "create",
      window: { label: "Week 2" },
    });
  });

  it("with no period and nothing due, says so", () => {
    expect(decide({ today: "2026-09-12" })).toEqual({ kind: "nothing_due" });
    expect(decide({ status: "paused" })).toEqual({ kind: "nothing_due" });
  });

  it("resumes the draft of the due period", () => {
    const draft = review({
      period_start: "2026-09-07",
      period_end: "2026-09-13",
    });
    expect(decide({ reviews: [draft] })).toEqual({
      kind: "resume",
      review: draft,
    });
  });

  it("with a period, takes only a real window that has closed", () => {
    const week2 = { period_start: "2026-09-14", period_end: "2026-09-20" };
    expect(decide({ request: week2 })).toMatchObject({
      kind: "create",
      window: { label: "Week 2" },
    });
    expect(
      decide({
        request: { period_start: "2026-09-14", period_end: "2026-09-21" },
      }),
    ).toEqual({ kind: "not_a_window" });
    expect(decide({ request: week2, today: "2026-09-19" })).toEqual({
      kind: "not_closed",
    });
  });

  it("refuses a period already saved", () => {
    expect(
      decide({
        request: { period_start: "2026-09-07", period_end: "2026-09-13" },
        reviews: [week1Saved],
      }),
    ).toEqual({ kind: "saved" });
  });
});
