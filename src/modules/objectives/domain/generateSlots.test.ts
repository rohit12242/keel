import { describe, expect, it } from "vitest";
import { generateSlots } from "./generateSlots";

describe("generateSlots (fixed)", () => {
  it("makes one day slot per planned weekday in range", () => {
    // 2026-09-14 is a Monday. Mon–Fri over one week → 5 slots.
    const slots = generateSlots({
      scheduleMode: "fixed",
      plannedWeekdays: [1, 2, 3, 4, 5],
      minutesPerPlannedDay: 120,
      startDate: "2026-09-14",
      endDate: "2026-09-20", // Sunday
    });
    expect(slots.map((s) => s.periodStart)).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
    ]);
    expect(slots.every((s) => s.periodKind === "day")).toBe(true);
    expect(slots.every((s) => s.periodStart === s.periodEnd)).toBe(true);
    expect(slots.every((s) => s.targetMinutes === 120)).toBe(true);
    expect(slots.every((s) => s.targetDays === null)).toBe(true);
  });

  it("includes both endpoints of the inclusive range", () => {
    const slots = generateSlots({
      scheduleMode: "fixed",
      plannedWeekdays: [1, 2, 3, 4, 5, 6, 7],
      minutesPerPlannedDay: 30,
      startDate: "2026-09-14",
      endDate: "2026-09-16",
    });
    expect(slots).toHaveLength(3);
  });

  it("refuses flexible schedules for now", () => {
    expect(() =>
      generateSlots({
        scheduleMode: "flexible",
        plannedWeekdays: [],
        minutesPerPlannedDay: 60,
        startDate: "2026-09-14",
        endDate: "2026-09-20",
      }),
    ).toThrow(/fixed/);
  });
});
