import { describe, expect, it } from "vitest";
import { assembleDay } from "./assembleDay";
import type { DayEntryRow, DayObjectiveRow } from "./rows";

/**
 * The assembler now computes what the query used to read from `plan_slot`
 * (W4-29): the covering slot, whether an entry is extra, the next planned date,
 * and which objectives are active. The rows it is given are facts only.
 */
const MON_TO_FRI = {
  seq: 0,
  schedule_mode: "fixed" as const,
  planned_weekdays: 0b11111, // Mon–Fri
  days_per_week: null,
  minutes_per_planned_day: 120,
  start_date: "2026-09-14",
  end_date: "2026-10-11",
};

const baseRow: DayObjectiveRow = {
  id: "obj-1",
  title: "Ship Keel",
  segments: [MON_TO_FRI],
  status_events: [{ occurred_on: "2026-09-14", change: "created" }],
  entries: [],
  week_minutes: 0,
};

function entry(over: Partial<DayEntryRow> = {}): DayEntryRow {
  return {
    id: "e1",
    objective_id: "obj-1",
    local_date: "2026-09-16",
    tz: "Asia/Kolkata",
    minutes: 60,
    note: "Wrote the day read.",
    link: null,
    occurred_at_local: null,
    logged_at: "2026-09-16T10:00:00Z",
    ...over,
  };
}

describe("assembleDay", () => {
  it("returns empty objectives and zero totals for no rows", () => {
    expect(assembleDay("2026-09-16", [])).toEqual({
      date: "2026-09-16",
      objectives: [],
      totals: { today_minutes: 0, week_minutes: 0, extra_off_day_minutes: 0 },
      last_deviation: null,
    });
  });

  it("computes the slot for a planned day, with no id on it", () => {
    const day = assembleDay("2026-09-16", [baseRow]); // a Wednesday
    const o = day.objectives[0];
    expect(o.slot).toEqual({
      period_kind: "day",
      period_start: "2026-09-16",
      period_end: "2026-09-16",
      target_minutes: 120,
      target_days: null,
    });
    expect(o.slot && "id" in o.slot).toBe(false);
    expect(o.schedule.planned_weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(o.schedule.label).toBe("FIXED · MON–FRI · 2h 00m PER DAY");
  });

  it("has no slot on an off day, and the entry logged then is extra", () => {
    const day = assembleDay("2026-09-19", [
      { ...baseRow, entries: [entry({ local_date: "2026-09-19" })] },
    ]); // a Saturday
    const o = day.objectives[0];
    expect(o.slot).toBeNull();
    expect(o.entries[0].extra).toBe(true);
    expect(day.totals.extra_off_day_minutes).toBe(60);
  });

  it("has no slot on a day inside a past paused stretch, and that effort is extra", () => {
    // The behaviour the plan_slot table used to encode by not writing rows.
    // The objective is active NOW (it resumed), so it is on Today; the date
    // being viewed sits inside the stretch it was paused for. That is the
    // difference between currentStatus (is it on Today) and statusOn (was it
    // planned that day).
    const resumedAfterAPause = {
      ...baseRow,
      status_events: [
        { occurred_on: "2026-09-14", change: "created" as const },
        { occurred_on: "2026-09-16", change: "paused" as const },
        { occurred_on: "2026-09-21", change: "resumed" as const },
      ],
    };

    const paused = assembleDay("2026-09-17", [
      { ...resumedAfterAPause, entries: [entry({ local_date: "2026-09-17" })] },
    ]); // a Thursday: a planned weekday, but paused that week
    expect(paused.objectives[0].slot).toBeNull();
    expect(paused.objectives[0].entries[0].extra).toBe(true);
    expect(paused.totals.extra_off_day_minutes).toBe(60);

    // ...and the plan is back the day it resumed.
    const resumed = assembleDay("2026-09-21", [resumedAfterAPause]);
    expect(resumed.objectives[0].slot?.period_start).toBe("2026-09-21");
  });

  it("leaves out objectives that are not active, and their minutes", () => {
    const day = assembleDay("2026-09-16", [
      { ...baseRow, id: "active", week_minutes: 300, entries: [entry()] },
      {
        ...baseRow,
        id: "paused",
        week_minutes: 120,
        status_events: [
          { occurred_on: "2026-09-14", change: "created" },
          { occurred_on: "2026-09-15", change: "paused" },
        ],
        entries: [entry({ id: "e2", minutes: 30 })],
      },
      // No events at all: no status, so not on Today (ERD invariant 16).
      { ...baseRow, id: "statusless", status_events: [], week_minutes: 90 },
    ]);
    expect(day.objectives.map((o) => o.id)).toEqual(["active"]);
    expect(day.totals).toEqual({
      today_minutes: 60,
      week_minutes: 300,
      extra_off_day_minutes: 0,
    });
  });

  it("names the next planned date", () => {
    const day = assembleDay("2026-09-18", [baseRow]); // Friday
    expect(day.objectives[0].next_planned_date).toBe("2026-09-21"); // Monday
  });

  it("sums today's minutes across objectives", () => {
    const day = assembleDay("2026-09-16", [
      { ...baseRow, id: "a", entries: [entry()], week_minutes: 300 },
      {
        ...baseRow,
        id: "b",
        entries: [entry({ id: "e2", objective_id: "b", minutes: 45 })],
        week_minutes: 0,
      },
    ]);
    expect(day.totals.today_minutes).toBe(105);
    expect(day.totals.week_minutes).toBe(300);
  });
});
