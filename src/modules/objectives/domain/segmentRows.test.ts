import { describe, expect, it } from "vitest";
import { toSegment, type PlanSegmentRow } from "./segmentRows";

/**
 * The single mapping from a plan_segment row to what the slot rules take. Both
 * Today and the effort write go through it, so it is where a stored bitmask
 * becomes planned days.
 */
const FIXED: PlanSegmentRow = {
  seq: 0,
  schedule_mode: "fixed",
  planned_weekdays: 31,
  days_per_week: null,
  minutes_per_planned_day: 120,
  start_date: "2026-09-14",
  end_date: "2026-10-11",
};

describe("toSegment", () => {
  it("turns a fixed row's bitmask into ISO weekdays and carries the rest", () => {
    expect(toSegment(FIXED)).toEqual({
      scheduleMode: "fixed",
      plannedWeekdays: [1, 2, 3, 4, 5],
      minutesPerPlannedDay: 120,
      startDate: "2026-09-14",
      endDate: "2026-10-11",
    });
  });

  it("gives a flexible row (no bitmask) no planned weekdays", () => {
    const flexible: PlanSegmentRow = {
      ...FIXED,
      schedule_mode: "flexible",
      planned_weekdays: null,
      days_per_week: 3,
    };
    const segment = toSegment(flexible);
    expect(segment.scheduleMode).toBe("flexible");
    expect(segment.plannedWeekdays).toEqual([]);
  });

  it("keeps dates as the strings the row carried (NFR-12)", () => {
    const segment = toSegment(FIXED);
    expect(typeof segment.startDate).toBe("string");
    expect(segment.endDate).toBe(FIXED.end_date);
  });
});
