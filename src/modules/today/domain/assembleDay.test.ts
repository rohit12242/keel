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
  daily_minutes: [],
};

/** Minutes per date, as the query returns them. */
const days = (...pairs: [string, number][]) =>
  pairs.map(([local_date, minutes]) => ({ local_date, minutes }));

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
    expect(assembleDay("2026-09-16", [], null)).toEqual({
      date: "2026-09-16",
      objectives: [],
      totals: {
        today_minutes: 0,
        week_minutes: 0,
        extra_off_day_minutes: 0,
        today_planned_minutes: 0,
        today_to_go_minutes: 0,
      },
      last_deviation: null,
    });
  });

  it("computes the slot for a planned day, with no id on it", () => {
    const day = assembleDay("2026-09-16", [baseRow], null); // a Wednesday
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
    const day = assembleDay(
      "2026-09-19",
      [
        {
          ...baseRow,
          entries: [entry({ local_date: "2026-09-19" })],
          daily_minutes: days(["2026-09-19", 60]),
        },
      ],
      null,
    ); // a Saturday
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

    const paused = assembleDay(
      "2026-09-17",
      [
        {
          ...resumedAfterAPause,
          entries: [entry({ local_date: "2026-09-17" })],
          daily_minutes: days(["2026-09-17", 60]),
        },
      ],
      null,
    ); // a Thursday: a planned weekday, but paused that week
    expect(paused.objectives[0].slot).toBeNull();
    expect(paused.objectives[0].entries[0].extra).toBe(true);
    expect(paused.totals.extra_off_day_minutes).toBe(60);

    // ...and the plan is back the day it resumed.
    const resumed = assembleDay("2026-09-21", [resumedAfterAPause], null);
    expect(resumed.objectives[0].slot?.period_start).toBe("2026-09-21");
  });

  it("leaves out objectives that are not active, and their minutes", () => {
    const day = assembleDay(
      "2026-09-16",
      [
        {
          ...baseRow,
          id: "active",
          entries: [entry()],
          daily_minutes: days(["2026-09-14", 240], ["2026-09-16", 60]),
        },
        {
          ...baseRow,
          id: "paused",
          daily_minutes: days(["2026-09-15", 90], ["2026-09-16", 30]),
          status_events: [
            { occurred_on: "2026-09-14", change: "created" },
            { occurred_on: "2026-09-15", change: "paused" },
          ],
          entries: [entry({ id: "e2", minutes: 30 })],
        },
        // No events at all: no status, so not on Today (ERD invariant 16).
        {
          ...baseRow,
          id: "statusless",
          status_events: [],
          daily_minutes: days(["2026-09-16", 90]),
        },
      ],
      null,
    );
    expect(day.objectives.map((o) => o.id)).toEqual(["active"]);
    expect(day.totals).toEqual({
      today_minutes: 60,
      week_minutes: 300,
      extra_off_day_minutes: 0,
      today_planned_minutes: 120,
      today_to_go_minutes: 60,
    });
  });

  it("names the next planned date", () => {
    const day = assembleDay("2026-09-18", [baseRow], null); // Friday
    expect(day.objectives[0].next_planned_date).toBe("2026-09-21"); // Monday
  });

  it("sums today's minutes across objectives", () => {
    const day = assembleDay(
      "2026-09-16",
      [
        {
          ...baseRow,
          id: "a",
          entries: [entry()],
          daily_minutes: days(["2026-09-14", 240], ["2026-09-16", 60]),
        },
        {
          ...baseRow,
          id: "b",
          entries: [entry({ id: "e2", objective_id: "b", minutes: 45 })],
          daily_minutes: days(["2026-09-16", 45]),
        },
      ],
      null,
    );
    expect(day.totals.today_minutes).toBe(105);
    expect(day.totals.week_minutes).toBe(345);
  });

  it("keeps the entry's time of day when one was given, and omits it when not", () => {
    const day = assembleDay(
      "2026-09-16",
      [
        {
          ...baseRow,
          entries: [
            entry({ occurred_at_local: "09:30" }),
            entry({ id: "e2", occurred_at_local: null }),
          ],
        },
      ],
      null,
    );
    const [withTime, withoutTime] = day.objectives[0].entries;
    expect(withTime.occurred_at_local).toBe("09:30");
    expect("occurred_at_local" in withoutTime).toBe(false);
  });

  // --- which segment's schedule is shown (segmentInForce) -------------------

  it("shows the latest segment's schedule for a date after every segment, with no slot", () => {
    // Segment 1 (Mon/Wed/Fri) follows segment 0 (Mon–Fri). Given highest-seq
    // first, then last, so the pick is by seq and not by array position.
    const SEG_1 = {
      ...MON_TO_FRI,
      seq: 1,
      planned_weekdays: 0b10101, // Mon, Wed, Fri
      minutes_per_planned_day: 90,
      start_date: "2026-10-12",
      end_date: "2026-10-25",
    };
    for (const segments of [
      [SEG_1, MON_TO_FRI],
      [MON_TO_FRI, SEG_1],
    ]) {
      const o = assembleDay("2026-11-04", [{ ...baseRow, segments }], null)
        .objectives[0]; // a Wednesday, after both segments
      expect(o.slot).toBeNull();
      expect(o.schedule.planned_weekdays).toEqual([1, 3, 5]);
      expect(o.schedule.label).toBe("FIXED · MON, WED, FRI · 1h 30m PER DAY");
      expect(o.next_planned_date).toBeNull();
    }
  });

  it("degrades to an empty schedule for an objective with no segments", () => {
    // Every objective has segment 0 in practice; this pins that the assembler
    // degrades rather than throws if one ever arrives without. Pinned AS FOUND:
    // `mode` defaults to "fixed" while the fixed/flexible field choice defaults
    // to flexible, so the result mixes the two, outside the contract (G-18).
    const o = assembleDay(
      "2026-09-16",
      [{ ...baseRow, segments: [], entries: [entry()] }],
      null,
    ).objectives[0];
    expect(o.schedule).toEqual({
      mode: "fixed",
      minutes_per_planned_day: 0,
      days_per_week: 0,
      label: "FIXED ·  · 0h 00m PER DAY",
    });
    expect(o.slot).toBeNull();
    expect(o.next_planned_date).toBeNull();
    expect(o.entries[0].extra).toBe(true);
  });

  it("reads a fixed segment with no bitmask as no planned days", () => {
    // The row type allows null; toSegment makes the same choice, so the
    // schedule shown and the slot computed cannot disagree about the days.
    const o = assembleDay(
      "2026-09-16",
      [{ ...baseRow, segments: [{ ...MON_TO_FRI, planned_weekdays: null }] }],
      null,
    ).objectives[0];
    expect(o.schedule.planned_weekdays).toEqual([]);
    expect(o.slot).toBeNull();
  });

  it("plans a flexible objective by its week, and its effort is not extra", () => {
    // Until I-01 this pinned the wrong answer the W4-29 review found (G-17): a
    // flexible objective computed no slot and every entry was extra. Week
    // slots exist now, so the day is covered by its week.
    const FLEXIBLE = {
      ...MON_TO_FRI,
      schedule_mode: "flexible" as const,
      planned_weekdays: null,
      days_per_week: 3,
      minutes_per_planned_day: 60,
    };
    const day = assembleDay(
      "2026-09-16",
      [{ ...baseRow, segments: [FLEXIBLE], entries: [entry()] }],
      null,
    );
    const o = day.objectives[0];
    expect(o.schedule).toEqual({
      mode: "flexible",
      minutes_per_planned_day: 60,
      days_per_week: 3,
      label: "FLEXIBLE · 3 DAYS/WEEK · 1h 00m PER DAY",
    });
    expect(o.slot).toEqual({
      period_kind: "week",
      period_start: "2026-09-14",
      period_end: "2026-09-20",
      target_minutes: 180,
      target_days: 3,
    });
    expect(o.entries[0].extra).toBe(false);
    expect(day.totals.extra_off_day_minutes).toBe(0);
    expect(o.next_planned_date).toBe("2026-09-17");
  });

  it("G-18 (open): a flexible segment with no days_per_week shows 0", () => {
    // Unreachable through the schema (plan_segment requires days_per_week for
    // a flexible segment); pins that the assembler does not throw. The 0 is
    // below the contract's minimum of 1 — see G-18.
    const o = assembleDay(
      "2026-09-16",
      [
        {
          ...baseRow,
          segments: [
            {
              ...MON_TO_FRI,
              schedule_mode: "flexible" as const,
              planned_weekdays: null,
              days_per_week: null,
            },
          ],
        },
      ],
      null,
    ).objectives[0];
    expect(o.schedule.days_per_week).toBe(0);
    expect(o.schedule.label).toBe("FLEXIBLE · 0 DAYS/WEEK · 2h 00m PER DAY");
  });

  it("carries the last deviation it is given, unchanged", () => {
    const deviation = {
      id: "d",
      objective_ids: ["o"],
      local_date: "2026-09-15",
      tz: "UTC",
      kind: "drifted" as const,
      what_happened: "w",
      reasoning: "r",
      minutes: 20,
      pattern_id: null,
      pattern_name: null,
      verdict: null,
      verdict_review_id: null,
      pattern_nth: null,
      review_due_on: null,
    };
    expect(assembleDay("2026-09-16", [], deviation).last_deviation).toBe(
      deviation,
    );
  });
});

describe("assembleDay — what Today needs (G24–G28)", () => {
  const FLEXIBLE = {
    ...MON_TO_FRI,
    schedule_mode: "flexible" as const,
    planned_weekdays: null,
    days_per_week: 3,
    minutes_per_planned_day: 60,
  };

  it("reads a flexible card's week up to the date only", () => {
    const day = assembleDay(
      "2026-09-16", // Wednesday
      [
        {
          ...baseRow,
          segments: [FLEXIBLE],
          daily_minutes: days(
            ["2026-09-14", 60],
            ["2026-09-16", 30],
            ["2026-09-21", 90], // next week: never in this one
          ),
        },
      ],
      null,
    );
    expect(day.objectives[0]).toMatchObject({
      period_logged_minutes: 90,
      period_days_worked: 2,
    });
  });

  it("gives a fixed card no week progress", () => {
    const o = assembleDay("2026-09-16", [baseRow], null).objectives[0];
    expect("period_logged_minutes" in o).toBe(false);
    expect("period_days_worked" in o).toBe(false);
  });

  it("plans time only for fixed day slots, and never goes below zero to go", () => {
    const day = assembleDay(
      "2026-09-16",
      [
        // 120 planned, 150 logged: over, so nothing to go.
        {
          ...baseRow,
          id: "over",
          entries: [entry({ minutes: 150 })],
          daily_minutes: days(["2026-09-16", 150]),
        },
        // 120 planned, 30 logged: 90 to go.
        {
          ...baseRow,
          id: "short",
          entries: [entry({ id: "e2", objective_id: "short", minutes: 30 })],
          daily_minutes: days(["2026-09-16", 30]),
        },
        // Flexible: plans no particular day.
        { ...baseRow, id: "flex", segments: [FLEXIBLE] },
      ],
      null,
    );
    expect(day.totals).toMatchObject({
      today_planned_minutes: 240,
      today_to_go_minutes: 90,
    });
  });

  it("counts extra over the whole Monday-to-Sunday week, not just the date", () => {
    // Fixed Mon–Fri from Wed 16 Sep: Monday 14th falls before the plan, so
    // no slot covers it — effort logged then is extra in this week.
    const fromWednesday = {
      ...baseRow,
      segments: [{ ...MON_TO_FRI, start_date: "2026-09-16" }],
      status_events: [
        { occurred_on: "2026-09-16", change: "created" as const },
      ],
      daily_minutes: days(["2026-09-14", 40], ["2026-09-16", 60]),
    };
    expect(
      assembleDay("2026-09-17", [fromWednesday], null).totals,
    ).toMatchObject({ week_minutes: 100, extra_off_day_minutes: 40 });
  });

  it("carries adherence to date and its band, as the objectives read has them", () => {
    const day = assembleDay(
      "2026-09-17", // Thursday: Mon–Wed ended, Thursday is today
      [
        {
          ...baseRow,
          daily_minutes: days(
            ["2026-09-14", 120],
            ["2026-09-15", 120],
            ["2026-09-16", 60],
          ),
        },
      ],
      null,
    );
    // 300 credited of 480 (four day slots, today's unlogged): 63%.
    expect(day.objectives[0]).toMatchObject({
      adherence_to_date: 63,
      track: "at_risk",
    });
  });

  it("says no band on the first day, and gives the start date either side of it", () => {
    const first = assembleDay("2026-09-14", [baseRow], null).objectives[0];
    expect(first).toMatchObject({ track: null, start_date: "2026-09-14" });
    const later = {
      ...baseRow,
      segments: [{ ...MON_TO_FRI, start_date: "2026-09-21" }],
    };
    expect(
      assembleDay("2026-09-16", [later], null).objectives[0].start_date,
    ).toBe("2026-09-21");
  });
});
