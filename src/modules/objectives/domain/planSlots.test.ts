import { describe, expect, it } from "vitest";
import type { SegmentForSlots } from "./generateSlots";
import { planSlots, toGeneratedSlot } from "./planSlots";
import type { StatusEventRow } from "./statusTimeline";

/**
 * The schedule's slots, filtered by the status timeline (ERD invariant 10).
 * The one place pause suppression lives.
 */
const MON_TO_FRI: SegmentForSlots = {
  scheduleMode: "fixed",
  plannedWeekdays: [1, 2, 3, 4, 5],
  minutesPerPlannedDay: 120,
  startDate: "2026-09-14", // Monday
  endDate: "2026-09-27", // Sunday, two weeks
};

const FLEXIBLE: SegmentForSlots = {
  scheduleMode: "flexible",
  plannedWeekdays: [],
  daysPerWeek: 4,
  minutesPerPlannedDay: 60,
  startDate: "2026-09-14",
  endDate: "2026-09-27",
};

const CREATED: StatusEventRow[] = [
  { occurred_on: "2026-09-14", change: "created" },
];

describe("planSlots — fixed", () => {
  it("keeps every planned day while the objective is active", () => {
    const slots = planSlots([MON_TO_FRI], CREATED);
    expect(slots).toHaveLength(10);
    expect(slots[0]).toEqual({
      periodKind: "day",
      periodStart: "2026-09-14",
      periodEnd: "2026-09-14",
      targetMinutes: 120,
      targetDays: null,
      activeDays: ["2026-09-14"],
      minutesPerDay: 120,
    });
  });

  it("drops the days the objective was paused for, and plans again on resume", () => {
    const events: StatusEventRow[] = [
      ...CREATED,
      { occurred_on: "2026-09-16", change: "paused" },
      { occurred_on: "2026-09-21", change: "resumed" },
    ];
    expect(planSlots([MON_TO_FRI], events).map((s) => s.periodStart)).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
    ]);
  });

  it("plans nothing with no status events (invariant 16)", () => {
    expect(planSlots([MON_TO_FRI], [])).toEqual([]);
  });
});

describe("planSlots — flexible", () => {
  it("keeps whole weeks while active, with every day available", () => {
    const slots = planSlots([FLEXIBLE], CREATED);
    expect(slots.map((s) => [s.periodStart, s.targetDays])).toEqual([
      ["2026-09-14", 4],
      ["2026-09-21", 4],
    ]);
    expect(slots[0].activeDays).toHaveLength(7);
    expect(slots[0].targetMinutes).toBe(240);
  });

  it("caps a week's day count by its active days when paused inside it", () => {
    // Paused Tue 15th, resumed Sat 19th: Mon, Sat, Sun active — 3 of the 4 asked.
    const events: StatusEventRow[] = [
      ...CREATED,
      { occurred_on: "2026-09-15", change: "paused" },
      { occurred_on: "2026-09-19", change: "resumed" },
    ];
    const [week] = planSlots([FLEXIBLE], events);
    expect(week.activeDays).toEqual(["2026-09-14", "2026-09-19", "2026-09-20"]);
    expect(week.targetDays).toBe(3);
    expect(week.targetMinutes).toBe(180);
  });

  it("keeps the asked-for count when the pause leaves enough days", () => {
    const events: StatusEventRow[] = [
      ...CREATED,
      { occurred_on: "2026-09-15", change: "paused" },
      { occurred_on: "2026-09-17", change: "resumed" },
    ];
    expect(planSlots([FLEXIBLE], events)[0].targetDays).toBe(4);
  });

  it("drops a week with no active day", () => {
    const events: StatusEventRow[] = [
      ...CREATED,
      { occurred_on: "2026-09-14", change: "paused" },
      { occurred_on: "2026-09-21", change: "resumed" },
    ];
    expect(planSlots([FLEXIBLE], events).map((s) => s.periodStart)).toEqual([
      "2026-09-21",
    ]);
  });
});

describe("toGeneratedSlot", () => {
  it("strips the planning detail the contract does not carry", () => {
    const [slot] = planSlots([MON_TO_FRI], CREATED);
    expect(toGeneratedSlot(slot)).toEqual({
      periodKind: "day",
      periodStart: "2026-09-14",
      periodEnd: "2026-09-14",
      targetMinutes: 120,
      targetDays: null,
    });
  });
});
