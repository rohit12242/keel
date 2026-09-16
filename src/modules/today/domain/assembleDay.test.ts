import { describe, expect, it } from "vitest";
import { assembleDay } from "./assembleDay";
import type { DayObjectiveRow } from "./rows";

const baseRow: DayObjectiveRow = {
  id: "obj-1",
  title: "Ship Keel",
  schedule_mode: "fixed",
  planned_weekdays: 0b11111, // Mon–Fri
  days_per_week: null,
  minutes_per_planned_day: 120,
  slot_id: "slot-1",
  period_kind: "day",
  period_start: "2026-09-16",
  period_end: "2026-09-16",
  target_minutes: 120,
  target_days: null,
  entries: [],
  logged_minutes: 0,
  extra_minutes: 0,
  next_planned_date: "2026-09-17",
  week_minutes: 0,
};

describe("assembleDay", () => {
  it("returns empty objectives and zero totals for no rows", () => {
    expect(assembleDay("2026-09-16", [])).toEqual({
      date: "2026-09-16",
      objectives: [],
      totals: { today_minutes: 0, week_minutes: 0, extra_off_day_minutes: 0 },
      last_deviation: null,
    });
  });

  it("maps a planned objective with a slot and its schedule label", () => {
    const day = assembleDay("2026-09-16", [baseRow]);
    const o = day.objectives[0];
    expect(o.slot?.period_start).toBe("2026-09-16");
    expect(o.schedule.planned_weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(o.schedule.label).toBe("FIXED · MON–FRI · 2h 00m PER DAY");
  });

  it("sums today and extra totals across objectives, carries week", () => {
    const day = assembleDay("2026-09-16", [
      {
        ...baseRow,
        id: "a",
        logged_minutes: 60,
        extra_minutes: 0,
        week_minutes: 300,
      },
      {
        ...baseRow,
        id: "b",
        logged_minutes: 45,
        extra_minutes: 45,
        slot_id: null,
        week_minutes: 300,
      },
    ]);
    expect(day.totals).toEqual({
      today_minutes: 105,
      week_minutes: 300,
      extra_off_day_minutes: 45,
    });
    expect(day.objectives[1].slot).toBeNull();
  });
});
