import { describe, expect, it } from "vitest";
import type { EffortEntry, PlanWeek, ScheduleDay } from "@/shared/contract";
import { dayTag, lastDay, weekDialog, weekRows } from "./effortView";

/** Sat 5 Sep 2026. */
const TODAY = "2026-09-05";

const day = (d: Partial<ScheduleDay> & { date: string }): ScheduleDay => ({
  state: "planned_no_log",
  segment_id: "s0",
  logged_minutes: 0,
  target_minutes: 120,
  ...d,
});

const entry = (
  local_date: string,
  occurred_at_local: string,
  minutes: number,
  note = "n",
): EffortEntry => ({
  id: `${local_date}-${occurred_at_local}`,
  objective_id: "o1",
  local_date,
  tz: "Asia/Kolkata",
  minutes,
  note,
  occurred_at_local,
  logged_at: `${local_date}T10:00:00Z`,
  extra: false,
});

const week = (
  period_start: string,
  period_end: string,
  f: Partial<PlanWeek["figures"]> = {},
): PlanWeek => ({
  period_start,
  period_end,
  figures: {
    adherence_pct: 0,
    logged_minutes: 0,
    target_minutes: 0,
    ...f,
  },
});

describe("dayTag", () => {
  it("reads all five states, with over and short", () => {
    expect(
      dayTag(day({ date: TODAY, state: "target_met", logged_minutes: 120 })),
    ).toEqual({ text: "✓ Met", tone: "ok" });
    expect(
      dayTag(day({ date: TODAY, state: "target_met", logged_minutes: 150 })),
    ).toEqual({ text: "✓ Met · +30m over", tone: "ok" });
    expect(
      dayTag(day({ date: TODAY, state: "worked_short", logged_minutes: 100 })),
    ).toEqual({ text: "− Short 20m", tone: "risk" });
    expect(dayTag(day({ date: TODAY }))).toEqual({
      text: "✕ Missed",
      tone: "behind",
    });
    expect(
      dayTag(
        day({
          date: TODAY,
          state: "off_day_worked",
          target_minutes: 0,
          logged_minutes: 60,
        }),
      ),
    ).toEqual({ text: "+ Extra on an off day", tone: "accent" });
    expect(dayTag({ date: TODAY, state: "off_day", segment_id: "s0" })).toEqual(
      { text: "Off day", tone: "neutral" },
    );
  });
});

describe("lastDay", () => {
  it("says so when nothing is logged", () => {
    expect(lastDay({ last_logged_on: null }, [], [], TODAY)).toEqual({
      kind: "none",
      text: "Nothing logged yet.",
    });
  });

  it("today: its target, bar, tag and entries in start order", () => {
    const card = lastDay(
      { last_logged_on: TODAY },
      [day({ date: TODAY, state: "worked_short", logged_minutes: 100 })],
      [
        entry(TODAY, "14:00", 40, "later"),
        entry(TODAY, "09:20", 60, "first"),
        entry("2026-09-04", "09:00", 30),
      ],
      TODAY,
    );
    expect(card).toEqual({
      kind: "day",
      title: "Sat 5 Sep · today",
      line: "planned 2h 00m · 2 entries",
      bar: { pct: 83.3, met: false },
      logged: "1h 40m",
      tag: { text: "− Short 20m", tone: "risk" },
      rows: [
        {
          id: `${TODAY}-09:20`,
          time: "09:20–10:20",
          note: "first",
          minutes: "1h",
        },
        {
          id: `${TODAY}-14:00`,
          time: "14:00–14:40",
          note: "later",
          minutes: "40m",
        },
      ],
    });
  });

  it("another day, an off day, over target capped at a full bar", () => {
    const off = lastDay(
      { last_logged_on: "2026-08-30" },
      [
        day({
          date: "2026-08-30",
          state: "off_day_worked",
          target_minutes: 0,
          logged_minutes: 60,
        }),
      ],
      [entry("2026-08-30", "08:00", 60)],
      TODAY,
    );
    expect(off).toMatchObject({
      title: "Sun 30 Aug",
      line: "off day · 1 entry",
      bar: null,
      logged: "1h",
    });
    const over = lastDay(
      { last_logged_on: "2026-09-04" },
      [day({ date: "2026-09-04", state: "target_met", logged_minutes: 150 })],
      [],
      TODAY,
    );
    expect(over).toMatchObject({ bar: { pct: 100, met: true } });
  });

  it("reads a day the grid doesn't have as an empty off day", () => {
    expect(
      lastDay({ last_logged_on: "2026-09-04" }, [], [], TODAY),
    ).toMatchObject({
      line: "off day · 0 entries",
      logged: "0m",
      tag: { text: "Off day" },
    });
  });
});

describe("weekRows", () => {
  const weeks = [
    week("2026-08-23", "2026-08-30", {
      target_minutes: 1680,
      logged_minutes: 1500,
      planned_days: 7,
      target_met_days: 5,
      over_target_minutes: 30,
      extra_off_day_minutes: 60,
    }),
    week("2026-08-31", "2026-09-06"),
    week("2026-09-07", "2026-09-13"),
  ];

  it("lists the weeks begun, Week 1 onwards, the current one so far", () => {
    const rows = weekRows({ weeks }, TODAY);
    expect(rows.map((r) => [r.n, r.label, r.soFar])).toEqual([
      [1, "Week 1 · Sun 23 Aug – Sun 30 Aug", false],
      [2, "Week 2 · Mon 31 Aug – Sun 6 Sep", true],
    ]);
    expect(rows[0]).toMatchObject({
      planned: "28h 00m",
      logged: "25h 00m",
      met: "5 of 7",
      over: "+30m",
      unplanned: "1h",
    });
    expect(rows[1]).toMatchObject({
      met: "0 of 0",
      over: "0m",
      unplanned: "0m",
    });
  });

  it("is not so far on the week's last day", () => {
    expect(weekRows({ weeks }, "2026-09-06")[1].soFar).toBe(false);
  });
});

describe("weekDialog", () => {
  const w = week("2026-08-31", "2026-09-06", {
    target_minutes: 720,
    logged_minutes: 625,
    planned_days: 6,
    target_met_days: 3,
    over_target_minutes: 30,
  });
  const grid = [
    day({ date: "2026-08-30", state: "target_met", logged_minutes: 120 }),
    day({ date: "2026-08-31", state: "target_met", logged_minutes: 150 }),
    day({ date: "2026-09-01" }),
    day({ date: "2026-09-05", state: "worked_short", logged_minutes: 60 }),
    { date: "2026-09-06", state: "off_day" as const, segment_id: "s0" },
  ];

  it("titles the week, sums it up, and lists each day up to today", () => {
    const d = weekDialog(
      { n: 2, week: w },
      grid,
      [entry("2026-08-31", "09:00", 150), entry("2026-09-05", "09:00", 60)],
      TODAY,
    );
    expect(d.title).toBe("Week 2 · Mon 31 Aug – Sun 6 Sep");
    expect(d.sub).toBe(
      "Planned 12h 00m · logged 10h 25m · 3 of 6 met · +30m over plan",
    );
    expect(
      d.days.map((x) => [x.chip, x.title, x.logged, x.tag.text, x.empty]),
    ).toEqual([
      [
        "Mon 31",
        "Mon 31 Aug · planned 2h",
        "2h 30m",
        "✓ Met · +30m over",
        null,
      ],
      ["Tue 1", "Tue 1 Sep · planned 2h", "0m", "✕ Missed", "Nothing logged."],
      ["Sat 5", "Sat 5 Sep · planned 2h", "1h", "− Short 1h", null],
    ]);
    expect(d.days[0].rows).toHaveLength(1);
  });

  it("leaves out the over part when there is none, and reads an off day", () => {
    const d = weekDialog(
      {
        n: 2,
        week: { ...w, figures: { ...w.figures, over_target_minutes: 0 } },
      },
      grid,
      [],
      "2026-09-07",
    );
    expect(d.sub).toBe("Planned 12h 00m · logged 10h 25m · 3 of 6 met");
    expect(d.days.at(-1)).toMatchObject({
      title: "Sun 6 Sep · off day",
      logged: "0m",
    });
    const bare = weekDialog(
      { n: 1, week: week("2026-08-31", "2026-09-06") },
      [],
      [],
      TODAY,
    );
    expect(bare.sub).toBe("Planned 0h 00m · logged 0h 00m · 0 of 0 met");
  });
});
