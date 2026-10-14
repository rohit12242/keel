import { describe, expect, it } from "vitest";
import type { SegmentForSlots } from "@/modules/objectives/domain/generateSlots";
import type { StatusEventRow } from "@/modules/objectives/domain/statusTimeline";
import {
  effortMonth,
  longestStreak,
  mondayOf,
  parseMonth,
  type EffortEntryFact,
} from "./effortMonth";
import { planSlots } from "@/modules/objectives/domain/planSlots";

/** Mon/Wed/Fri, an hour a day — the Effort tab design's objective. */
const MWF: SegmentForSlots = {
  scheduleMode: "fixed",
  plannedWeekdays: [1, 3, 5],
  minutesPerPlannedDay: 60,
  startDate: "2026-11-02",
  endDate: "2026-12-20",
};
const FLEX: SegmentForSlots = {
  scheduleMode: "flexible",
  plannedWeekdays: [],
  daysPerWeek: 2,
  minutesPerPlannedDay: 30,
  startDate: "2026-12-07", // a Monday, so its week slots are Monday weeks
  endDate: "2026-12-20",
};
const created = (on: string): StatusEventRow[] => [
  { occurred_on: on, change: "created" },
];
const entry = (
  local_date: string,
  minutes: number,
  note = "n",
): EffortEntryFact => ({ local_date, minutes, note });

const december = (
  parseMonth("2026-12") as { ok: true; value: { first: string; last: string } }
).value;

function run(over: {
  entries: EffortEntryFact[];
  today?: string;
  segments?: SegmentForSlots[];
  statusEvents?: StatusEventRow[];
}) {
  return effortMonth({
    month: "2026-12",
    range: december,
    today: over.today ?? "2026-12-31",
    segments: over.segments ?? [MWF],
    statusEvents: over.statusEvents ?? created("2026-11-02"),
    entries: over.entries,
  });
}

describe("parseMonth", () => {
  it("gives the month's first and last day, across a year end and a leap February", () => {
    expect(parseMonth("2026-12")).toEqual({
      ok: true,
      value: { first: "2026-12-01", last: "2026-12-31" },
    });
    expect(parseMonth("2028-02")).toEqual({
      ok: true,
      value: { first: "2028-02-01", last: "2028-02-29" },
    });
    expect(parseMonth("2026-04")).toEqual({
      ok: true,
      value: { first: "2026-04-01", last: "2026-04-30" },
    });
  });

  it.each([null, "", "2026-13", "2026-00", "2026-1", "26-12", "2026-12-01"])(
    "refuses %j",
    (bad) => {
      expect(parseMonth(bad)).toEqual({
        ok: false,
        error: [{ field: "month", message: "Required; must be YYYY-MM." }],
      });
    },
  );
});

describe("mondayOf", () => {
  it("is the date itself on a Monday, and the Monday before otherwise", () => {
    expect(mondayOf("2026-11-30")).toBe("2026-11-30");
    expect(mondayOf("2026-12-02")).toBe("2026-11-30");
    expect(mondayOf("2026-12-06")).toBe("2026-11-30"); // Sunday
  });
});

describe("effortMonth", () => {
  it("reads like the design: sessions, missed planned days, and vs target", () => {
    const m = run({
      entries: [
        entry("2026-12-02", 60, "Caching"),
        entry("2026-12-09", 50, "Data stores"),
        entry("2026-12-11", 35, "Diagrammed one system"),
      ],
    });
    expect(m.weeks[0]).toEqual({
      week_start: "2026-11-30",
      days: [
        {
          date: "2026-12-02",
          planned: true,
          minutes: 60,
          note: "Caching",
          vs_target: 0,
        },
        {
          date: "2026-12-04",
          planned: true,
          minutes: null,
          note: null,
          vs_target: -60,
        },
      ],
      subtotal_minutes: 60,
      planned_days_worked: "1 of 2 planned days worked",
    });
    expect(m.weeks[1]).toMatchObject({
      week_start: "2026-12-07",
      subtotal_minutes: 85,
      planned_days_worked: "2 of 3 planned days worked",
    });
    expect(
      m.weeks[1].days.map((d) => [d.date, d.minutes, d.vs_target]),
    ).toEqual([
      ["2026-12-07", null, -60],
      ["2026-12-09", 50, -10],
      ["2026-12-11", 35, -25],
    ]);
  });

  it("puts a day's vs target on its first session, over the day's total", () => {
    const m = run({
      entries: [entry("2026-12-02", 40), entry("2026-12-02", 30)],
    });
    expect(m.weeks[0].days.slice(0, 2)).toEqual([
      {
        date: "2026-12-02",
        planned: true,
        minutes: 40,
        note: "n",
        vs_target: 10,
      },
      {
        date: "2026-12-02",
        planned: true,
        minutes: 30,
        note: "n",
        vs_target: null,
      },
    ]);
    expect(m.weeks[0].subtotal_minutes).toBe(70);
  });

  it("shows off-day effort with no target, and counts it as extra", () => {
    const m = run({ entries: [entry("2026-12-05", 45)] }); // a Saturday
    expect(m.weeks[0].days).toContainEqual({
      date: "2026-12-05",
      planned: false,
      minutes: 45,
      note: "n",
      vs_target: null,
    });
    expect(m.totals.extra_off_day_minutes).toBe(45);
  });

  it("lists no missed day after today, and no week with nothing in it", () => {
    const m = run({ entries: [], today: "2026-12-08" });
    expect(m.weeks.flatMap((w) => w.days.map((d) => d.date))).toEqual([
      "2026-12-02",
      "2026-12-04",
      "2026-12-07",
    ]);
  });

  it("lists no missed day while paused, and paused effort is extra", () => {
    const m = run({
      entries: [entry("2026-12-09", 20)],
      statusEvents: [
        ...created("2026-11-02"),
        { occurred_on: "2026-12-07", change: "paused" },
      ],
    });
    expect(
      m.weeks.flatMap((w) => w.days.map((d) => [d.date, d.planned])),
    ).toEqual([
      ["2026-12-02", true],
      ["2026-12-04", true],
      ["2026-12-09", false],
    ]);
    expect(m.totals.extra_off_day_minutes).toBe(20);
  });

  it("totals the whole objective, not the month", () => {
    const m = run({
      entries: [entry("2026-11-02", 60), entry("2026-12-02", 30)],
    });
    expect(m.totals).toMatchObject({ logged_minutes: 90, sessions: 2 });
  });

  it("says how many days a flexible week worked, since no day is planned", () => {
    const m = run({
      segments: [FLEX],
      statusEvents: created("2026-12-07"),
      entries: [
        entry("2026-12-08", 30),
        entry("2026-12-15", 30),
        entry("2026-12-16", 30),
      ],
    });
    expect(m.weeks.map((w) => w.planned_days_worked)).toEqual([
      "1 day worked",
      "2 days worked",
    ]);
    expect(m.weeks[0].days).toEqual([
      {
        date: "2026-12-08",
        planned: true,
        minutes: 30,
        note: "n",
        vs_target: 0,
      },
    ]);
  });
});

describe("longestStreak", () => {
  const logged = (...dates: string[]) => new Map(dates.map((d) => [d, 1]));
  const fixed = planSlots([MWF], created("2026-11-02"));

  it("counts planned days worked in a row, ignoring off days between them", () => {
    // Mon 30 Nov, Wed 2, Fri 4, Mon 7 — then Wed 9 missed.
    expect(
      longestStreak(
        fixed,
        logged("2026-11-30", "2026-12-02", "2026-12-04", "2026-12-07"),
      ),
    ).toBe(4);
  });

  it("is broken by a planned day not worked", () => {
    expect(
      longestStreak(fixed, logged("2026-11-30", "2026-12-04", "2026-12-07")),
    ).toBe(2);
  });

  it("is zero with nothing worked", () => {
    expect(longestStreak(fixed, logged())).toBe(0);
  });

  it("adds a flexible week's days when it met its target, and breaks when it fell short", () => {
    const flex = planSlots([FLEX], created("2026-12-07"));
    expect(
      longestStreak(
        flex,
        logged("2026-12-07", "2026-12-08", "2026-12-14", "2026-12-15"),
      ),
    ).toBe(4);
    expect(
      longestStreak(flex, logged("2026-12-07", "2026-12-14", "2026-12-15")),
    ).toBe(2);
  });
});
