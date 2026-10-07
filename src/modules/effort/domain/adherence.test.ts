import { describe, expect, it } from "vitest";
import type { SegmentForSlots } from "@/modules/objectives/domain/generateSlots";
import { planSlots } from "@/modules/objectives/domain/planSlots";
import type { StatusEventRow } from "@/modules/objectives/domain/statusTimeline";
import { figures } from "./adherence";

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
    });
  });
});
