import { describe, expect, it } from "vitest";
import type { ScheduleGrid } from "@/shared/contract";
import type { PlannedSlot } from "./planSlots";
import type { ObjectiveRow, ObjectiveSegmentRow } from "./rows";
import { assembleGrid, dayState, parseGridRange } from "./scheduleGrid";

/** docs/domain/day-states.md — each example and edge case there is here. */
const FIXED_SEG: ObjectiveSegmentRow = {
  id: "seg-0",
  seq: 0,
  schedule_mode: "fixed",
  planned_weekdays: 0b11111, // Mon–Fri
  days_per_week: null,
  minutes_per_planned_day: 60,
  start_date: "2026-11-02", // Monday
  end_date: "2026-11-08", // Sunday
  reason: "Why.",
  created_by_review_id: null,
};

const ROW: ObjectiveRow = {
  id: "obj-1",
  title: "Ship Keel",
  description: null,
  why_now: "Why.",
  success_criteria: "Done.",
  plan_link: null,
  review_cadence: "weekly",
  from_parked_idea_id: null,
  segments: [FIXED_SEG],
  status_events: [
    { occurred_on: "2026-11-02", change: "created", reason: null },
  ],
  daily_minutes: [],
};

function grid(row: ObjectiveRow, range = {}): ScheduleGrid {
  const r = assembleGrid(row, range);
  if (!r.ok) throw new Error("expected a grid");
  return r.value;
}

const states = (g: ScheduleGrid) => g.days.map((d) => [d.date, d.state]);

describe("dayState", () => {
  const daySlot = { periodKind: "day", minutesPerDay: 60 } as PlannedSlot;
  const weekSlot = { periodKind: "week", minutesPerDay: 60 } as PlannedSlot;

  it("gives a day no slot covers off_day, or off_day_worked with effort", () => {
    expect(dayState(null, 0)).toEqual({ state: "off_day", target_minutes: 0 });
    expect(dayState(null, 45)).toEqual({
      state: "off_day_worked",
      target_minutes: 0,
    });
  });

  it("judges a planned fixed day against its target", () => {
    expect(dayState(daySlot, 60).state).toBe("target_met");
    expect(dayState(daySlot, 30)).toEqual({
      state: "worked_short",
      target_minutes: 60,
    });
    expect(dayState(daySlot, 0)).toEqual({
      state: "planned_no_log",
      target_minutes: 60,
    });
  });

  it("calls an unworked flexible day off_day, never planned_no_log", () => {
    expect(dayState(weekSlot, 90).state).toBe("target_met");
    expect(dayState(weekSlot, 20).state).toBe("worked_short");
    expect(dayState(weekSlot, 0)).toEqual({
      state: "off_day",
      target_minutes: 0,
    });
  });
});

describe("parseGridRange", () => {
  it("accepts no range, either end, or both", () => {
    expect(parseGridRange(null, null)).toEqual({ ok: true, value: {} });
    expect(parseGridRange("2026-11-03", null)).toEqual({
      ok: true,
      value: { from: "2026-11-03" },
    });
    expect(parseGridRange(null, "2026-11-04")).toEqual({
      ok: true,
      value: { to: "2026-11-04" },
    });
    expect(parseGridRange("2026-11-03", "2026-11-03").ok).toBe(true);
  });

  it("refuses a malformed date, naming the parameter", () => {
    expect(parseGridRange("3 Nov", "2026-13-01")).toEqual({
      ok: false,
      error: [
        { field: "from", message: "Must be YYYY-MM-DD." },
        { field: "to", message: "Must be YYYY-MM-DD." },
      ],
    });
  });

  it("refuses to before from", () => {
    expect(parseGridRange("2026-11-05", "2026-11-04")).toEqual({
      ok: false,
      error: [{ field: "to", message: "Must not be before from." }],
    });
  });
});

describe("assembleGrid — fixed (the rule's first table)", () => {
  it("shows all five states across one week", () => {
    const g = grid({
      ...ROW,
      daily_minutes: [
        { local_date: "2026-11-02", minutes: 60 },
        { local_date: "2026-11-03", minutes: 30 },
        { local_date: "2026-11-07", minutes: 45 },
      ],
    });
    expect(states(g)).toEqual([
      ["2026-11-02", "target_met"],
      ["2026-11-03", "worked_short"],
      ["2026-11-04", "planned_no_log"],
      ["2026-11-05", "planned_no_log"],
      ["2026-11-06", "planned_no_log"],
      ["2026-11-07", "off_day_worked"],
      ["2026-11-08", "off_day"],
    ]);
    expect(g.days[0]).toEqual({
      date: "2026-11-02",
      state: "target_met",
      target_minutes: 60,
      segment_id: "seg-0",
      logged_minutes: 60,
    });
    expect(g.days[6]).toMatchObject({ target_minutes: 0, logged_minutes: 0 });
    expect(g).toMatchObject({
      objective_id: "obj-1",
      from: "2026-11-02",
      to: "2026-11-08",
    });
  });

  it("shows a paused planned day with effort as off_day_worked", () => {
    const g = grid({
      ...ROW,
      status_events: [
        ...ROW.status_events,
        { occurred_on: "2026-11-05", change: "paused", reason: null },
      ],
      daily_minutes: [{ local_date: "2026-11-05", minutes: 60 }],
    });
    expect(g.days[3]).toMatchObject({
      date: "2026-11-05",
      state: "off_day_worked",
      target_minutes: 0,
    });
  });
});

describe("assembleGrid — flexible", () => {
  it("shows worked days met or short and unworked days off", () => {
    const g = grid({
      ...ROW,
      segments: [
        {
          ...FIXED_SEG,
          schedule_mode: "flexible",
          planned_weekdays: null,
          days_per_week: 3,
        },
      ],
      daily_minutes: [
        { local_date: "2026-11-02", minutes: 60 },
        { local_date: "2026-11-03", minutes: 20 },
      ],
    });
    expect(g.days.map((d) => d.state)).toEqual([
      "target_met",
      "worked_short",
      "off_day",
      "off_day",
      "off_day",
      "off_day",
      "off_day",
    ]);
  });
});

describe("assembleGrid — segments and range", () => {
  const SEG_1: ObjectiveSegmentRow = {
    ...FIXED_SEG,
    id: "seg-1",
    seq: 1,
    start_date: "2026-11-09",
    end_date: "2026-11-15",
  };
  const EXTENDED: ObjectiveRow = { ...ROW, segments: [SEG_1, FIXED_SEG] };

  it("names the segment each day falls in across the boundary", () => {
    const g = grid(EXTENDED, { from: "2026-11-08", to: "2026-11-09" });
    expect(g.days.map((d) => [d.date, d.segment_id])).toEqual([
      ["2026-11-08", "seg-0"],
      ["2026-11-09", "seg-1"],
    ]);
  });

  it("defaults to the objective's whole span", () => {
    const g = grid(EXTENDED);
    expect([g.from, g.to, g.days.length]).toEqual([
      "2026-11-02",
      "2026-11-15",
      14,
    ]);
  });

  it("clamps a wider range to the plan", () => {
    const g = grid(ROW, { from: "2026-10-01", to: "2026-12-31" });
    expect([g.from, g.to, g.days.length]).toEqual([
      "2026-11-02",
      "2026-11-08",
      7,
    ]);
  });

  it("returns no days for a range entirely outside the plan", () => {
    expect(grid(ROW, { from: "2026-12-01", to: "2026-12-07" })).toEqual({
      objective_id: "obj-1",
      from: "2026-12-01",
      to: "2026-12-07",
      days: [],
    });
  });

  it("skips a day no segment covers rather than inventing one", () => {
    // The database refuses a gap (plan_segment_contiguous); this pins the
    // assembler's behaviour on a direct call.
    const gap: ObjectiveRow = {
      ...ROW,
      segments: [FIXED_SEG, { ...SEG_1, start_date: "2026-11-10" }],
    };
    expect(grid(gap).days.map((d) => d.date)).not.toContain("2026-11-09");
  });

  it("fails rather than guessing for a malformed objective", () => {
    expect(assembleGrid({ ...ROW, status_events: [] }, {})).toEqual({
      ok: false,
      error: "malformed",
    });
  });
});
