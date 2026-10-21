import { describe, expect, it } from "vitest";
import type { SegmentForSlots } from "@/modules/objectives/domain/generateSlots";
import { planSlots } from "@/modules/objectives/domain/planSlots";
import type { StatusEventRow } from "@/modules/objectives/domain/statusTimeline";
import { figures, type DailyMinutes } from "./adherence";

/**
 * docs/domain/adherence.md — each worked example and named edge case there has
 * a test here. Slots come from the real planSlots, so pauses are applied the
 * way every screen applies them.
 */
const FIXED: SegmentForSlots = {
  scheduleMode: "fixed",
  plannedWeekdays: [1, 2, 3, 4, 5],
  minutesPerPlannedDay: 60,
  startDate: "2026-11-02", // Monday
  endDate: "2026-11-08", // Sunday
};
const FLEXIBLE: SegmentForSlots = {
  scheduleMode: "flexible",
  plannedWeekdays: [],
  daysPerWeek: 3,
  minutesPerPlannedDay: 60,
  startDate: "2026-11-02",
  endDate: "2026-11-08",
};
const CREATED: StatusEventRow[] = [
  { occurred_on: "2026-11-02", change: "created" },
];

const fixed = (logged: Record<string, number>) =>
  figures(planSlots([FIXED], CREATED), logged);
const flexible = (logged: Record<string, number>) =>
  figures(planSlots([FLEXIBLE], CREATED), logged);

describe("figures — fixed (the rule's first table)", () => {
  it("is 0% of a real target with nothing logged", () => {
    expect(fixed({})).toEqual({
      adherence_pct: 0,
      logged_minutes: 0,
      target_minutes: 300,
      planned_days: 5,
      planned_days_worked: 0,
      target_met_days: 0,
      extra_off_day_minutes: 0,
      over_target_minutes: 0,
      planned_weeks: 0,
      target_met_weeks: 0,
    });
  });

  it("credits a short day and counts it worked but not met", () => {
    expect(fixed({ "2026-11-02": 60, "2026-11-03": 30 })).toMatchObject({
      adherence_pct: 30,
      logged_minutes: 90,
      planned_days_worked: 2,
      target_met_days: 1,
    });
  });

  it("caps a long day at its target, so it cannot make up a missed one", () => {
    expect(fixed({ "2026-11-02": 120 })).toMatchObject({
      adherence_pct: 20,
      logged_minutes: 120,
      target_met_days: 1,
    });
  });

  it("never goes above 100%", () => {
    const everyDay = Object.fromEntries(
      ["02", "03", "04", "05", "06"].map((d) => [`2026-11-${d}`, 200]),
    );
    expect(fixed(everyDay).adherence_pct).toBe(100);
  });

  it("counts off-day minutes as logged and extra, never in adherence", () => {
    expect(fixed({ "2026-11-02": 60, "2026-11-07": 45 })).toMatchObject({
      adherence_pct: 20,
      logged_minutes: 105,
      extra_off_day_minutes: 45,
    });
  });
});

describe("figures — flexible (counted by days, capped at the week's ask)", () => {
  it("is 100% for three full days of a three-day week", () => {
    expect(
      flexible({ "2026-11-02": 60, "2026-11-04": 60, "2026-11-06": 60 }),
    ).toMatchObject({
      adherence_pct: 100,
      target_minutes: 180,
      planned_days: 3,
      planned_days_worked: 3,
      target_met_days: 3,
      extra_off_day_minutes: 0,
    });
  });

  it("caps four worked days at the three the week asked for", () => {
    expect(
      flexible({
        "2026-11-02": 60,
        "2026-11-03": 60,
        "2026-11-04": 60,
        "2026-11-05": 60,
      }),
    ).toMatchObject({
      adherence_pct: 100,
      logged_minutes: 240,
      planned_days_worked: 3,
      target_met_days: 3,
    });
  });

  it("counts a short day as worked, not met", () => {
    expect(flexible({ "2026-11-02": 30, "2026-11-05": 60 })).toMatchObject({
      adherence_pct: 50,
      planned_days_worked: 2,
      target_met_days: 1,
    });
  });
});

describe("figures — paused, and nothing planned", () => {
  it("asks nothing for a paused stretch, and its minutes are extra", () => {
    const events: StatusEventRow[] = [
      ...CREATED,
      { occurred_on: "2026-11-04", change: "paused" },
    ];
    const f = figures(planSlots([FIXED], events), {
      "2026-11-02": 60,
      "2026-11-05": 60,
    });
    expect(f).toMatchObject({
      target_minutes: 120,
      planned_days: 2,
      adherence_pct: 50,
      extra_off_day_minutes: 60,
    });
  });

  it("is 0%, not a division by zero, with no slots, and still counts logged", () => {
    expect(figures([], { "2026-11-02": 30 })).toEqual({
      adherence_pct: 0,
      logged_minutes: 30,
      target_minutes: 0,
      planned_days: 0,
      planned_days_worked: 0,
      target_met_days: 0,
      extra_off_day_minutes: 30,
      over_target_minutes: 0,
      planned_weeks: 0,
      target_met_weeks: 0,
    });
  });
});

describe("figures — weeks met (flexible only)", () => {
  it("counts a week met when its minutes reach the week's target", () => {
    expect(
      flexible({ "2026-11-02": 60, "2026-11-04": 60, "2026-11-06": 60 }),
    ).toMatchObject({ planned_weeks: 1, target_met_weeks: 1 });
  });

  it("counts a short week as planned, not met", () => {
    expect(flexible({ "2026-11-02": 30, "2026-11-05": 60 })).toMatchObject({
      planned_weeks: 1,
      target_met_weeks: 0,
    });
  });

  it("is 0 and 0 on a fixed schedule, which has no weeks", () => {
    expect(fixed({ "2026-11-02": 60 })).toMatchObject({
      planned_weeks: 0,
      target_met_weeks: 0,
    });
  });
});

/**
 * Rule 7: every minute lands in exactly one place —
 * logged = credited + over target + extra on off days. figures() does not
 * return credited, so it is derived here from the same inputs.
 */
describe("figures — the sum (rule 7)", () => {
  const credited = (
    slots: ReturnType<typeof planSlots>,
    logged: DailyMinutes,
  ) =>
    slots.reduce((sum, slot) => {
      const inSlot = slot.activeDays.reduce((s, d) => s + (logged[d] ?? 0), 0);
      return sum + Math.min(inSlot, slot.targetMinutes);
    }, 0);

  const paused: StatusEventRow[] = [
    ...CREATED,
    { occurred_on: "2026-11-04", change: "paused" },
  ];

  const cases: [string, SegmentForSlots, StatusEventRow[], DailyMinutes][] = [
    ["fixed, nothing", FIXED, CREATED, {}],
    [
      "fixed, a short day",
      FIXED,
      CREATED,
      { "2026-11-02": 60, "2026-11-03": 30 },
    ],
    ["fixed, Mon 120", FIXED, CREATED, { "2026-11-02": 120 }],
    [
      "fixed, Mon 60 + Sat 45",
      FIXED,
      CREATED,
      { "2026-11-02": 60, "2026-11-07": 45 },
    ],
    [
      "flexible, three days",
      FLEXIBLE,
      CREATED,
      { "2026-11-02": 60, "2026-11-04": 60, "2026-11-06": 60 },
    ],
    [
      "flexible, Mon–Thu 60",
      FLEXIBLE,
      CREATED,
      {
        "2026-11-02": 60,
        "2026-11-03": 60,
        "2026-11-04": 60,
        "2026-11-05": 60,
      },
    ],
    [
      "flexible, short",
      FLEXIBLE,
      CREATED,
      { "2026-11-02": 30, "2026-11-05": 60 },
    ],
    ["fixed, paused Wed–Fri, Thu 60", FIXED, paused, { "2026-11-05": 60 }],
  ];

  it.each(cases)("holds for %s", (_name, segment, events, logged) => {
    const slots = planSlots([segment], events);
    const f = figures(slots, logged);
    expect(f.logged_minutes).toBe(
      credited(slots, logged) + f.over_target_minutes + f.extra_off_day_minutes,
    );
  });

  it("holds with no slots at all", () => {
    const f = figures([], { "2026-11-02": 30 });
    expect(f.logged_minutes).toBe(
      f.over_target_minutes + f.extra_off_day_minutes,
    );
  });

  it("states the worked examples exactly", () => {
    const row = (
      segment: SegmentForSlots,
      events: StatusEventRow[],
      logged: DailyMinutes,
    ) => {
      const slots = planSlots([segment], events);
      const f = figures(slots, logged);
      return [
        f.logged_minutes,
        credited(slots, logged),
        f.over_target_minutes,
        f.extra_off_day_minutes,
      ];
    };
    expect(row(FIXED, CREATED, { "2026-11-02": 120 })).toEqual([
      120, 60, 60, 0,
    ]);
    expect(row(FIXED, CREATED, { "2026-11-02": 60, "2026-11-07": 45 })).toEqual(
      [105, 60, 0, 45],
    );
    expect(
      row(FLEXIBLE, CREATED, {
        "2026-11-02": 60,
        "2026-11-03": 60,
        "2026-11-04": 60,
        "2026-11-05": 60,
      }),
    ).toEqual([240, 180, 60, 0]);
    expect(row(FIXED, paused, { "2026-11-05": 60 })).toEqual([60, 0, 0, 60]);
  });
});
