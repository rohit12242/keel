import { describe, expect, it } from "vitest";
import { generateSlots, type SegmentForSlots } from "./generateSlots";

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
});

/**
 * I-01: a flexible schedule plans weeks. Week k is [S + 7k, S + 7k + 6],
 * clipped to the end — the weekly tiling of docs/domain/review-windows.md.
 */
describe("generateSlots (flexible)", () => {
  const FLEXIBLE: SegmentForSlots = {
    scheduleMode: "flexible",
    plannedWeekdays: [],
    daysPerWeek: 3,
    minutesPerPlannedDay: 60,
    startDate: "2026-09-16", // a Wednesday: weeks run Wed–Tue, not Mon–Sun
    endDate: "2026-09-29",
  };

  it("makes one week slot per seven days, tiled from the start", () => {
    expect(generateSlots(FLEXIBLE)).toEqual([
      {
        periodKind: "week",
        periodStart: "2026-09-16",
        periodEnd: "2026-09-22",
        targetMinutes: 180,
        targetDays: 3,
      },
      {
        periodKind: "week",
        periodStart: "2026-09-23",
        periodEnd: "2026-09-29",
        targetMinutes: 180,
        targetDays: 3,
      },
    ]);
  });

  it("ends in a short week that cannot ask for more days than it has", () => {
    // 10 days: one full week, then a 3-day tail asking for at most 3 of 5.
    const slots = generateSlots({
      ...FLEXIBLE,
      daysPerWeek: 5,
      endDate: "2026-09-25",
    });
    expect(
      slots.map((s) => [s.periodStart, s.periodEnd, s.targetDays]),
    ).toEqual([
      ["2026-09-16", "2026-09-22", 5],
      ["2026-09-23", "2026-09-25", 3],
    ]);
    expect(slots[1].targetMinutes).toBe(180);
  });

  it("makes a single one-day week for a one-day run", () => {
    const slots = generateSlots({ ...FLEXIBLE, endDate: "2026-09-16" });
    expect(slots).toEqual([
      {
        periodKind: "week",
        periodStart: "2026-09-16",
        periodEnd: "2026-09-16",
        targetMinutes: 60,
        targetDays: 1,
      },
    ]);
  });

  it("runs a week across a month boundary", () => {
    const slots = generateSlots({
      ...FLEXIBLE,
      startDate: "2026-09-28",
      endDate: "2026-10-04",
    });
    expect(slots).toHaveLength(1);
    expect(slots[0].periodEnd).toBe("2026-10-04");
  });

  it("never lets two slots cover one day (invariant 9)", () => {
    const slots = generateSlots({ ...FLEXIBLE, endDate: "2026-11-30" });
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].periodStart > slots[i - 1].periodEnd).toBe(true);
    }
  });

  it("asks for nothing, rather than throwing, with no day count", () => {
    expect(generateSlots({ ...FLEXIBLE, daysPerWeek: null })).toEqual([]);
    expect(generateSlots({ ...FLEXIBLE, daysPerWeek: undefined })).toEqual([]);
  });
});
