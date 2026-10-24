import { describe, expect, it } from "vitest";
import type { Day, DayObjective } from "@/shared/contract";
import {
  card,
  compact,
  entryRows,
  loggable,
  longDate,
  railRow,
  schedulePill,
  summary,
  total,
} from "./todayView";

// The design's today: Sat 5 Sep 2026.
const DATE = "2026-09-05";

function objective(over: Partial<DayObjective> = {}): DayObjective {
  return {
    id: "o1",
    title: "Python and DSA",
    start_date: "2026-08-24",
    end_date: "2026-09-20",
    schedule: {
      mode: "fixed",
      planned_weekdays: [1, 2, 3, 4, 5, 6],
      minutes_per_planned_day: 120,
      label: "FIXED · MON–SAT · 2h 00m PER DAY",
    },
    slot: {
      period_kind: "day",
      period_start: DATE,
      period_end: DATE,
      target_minutes: 120,
      target_days: null,
    },
    next_planned_date: "2026-09-07",
    entries: [],
    logged_minutes: 0,
    adherence_to_date: 85,
    track: "on_track",
    ...over,
  };
}

const offToday = (over: Partial<DayObjective> = {}) =>
  objective({ slot: null, ...over });

function day(totals: Partial<Day["totals"]>): Day {
  return {
    date: DATE,
    objectives: [],
    totals: {
      today_minutes: 0,
      week_minutes: 0,
      extra_off_day_minutes: 0,
      today_planned_minutes: 0,
      today_to_go_minutes: 0,
      ...totals,
    },
    last_deviation: null,
  };
}

describe("durations", () => {
  it("totals read 2h 00m; compact places 45m, 1h 40m, 2h", () => {
    expect(total(0)).toBe("0h 00m");
    expect(total(280)).toBe("4h 40m");
    expect(compact(45)).toBe("45m");
    expect(compact(100)).toBe("1h 40m");
    expect(compact(120)).toBe("2h");
    expect(compact(65)).toBe("1h 05m");
  });
});

describe("longDate", () => {
  it("is the eyebrow's full date", () => {
    expect(longDate(DATE)).toBe("Saturday, 5 September");
    expect(longDate("2027-01-01")).toBe("Friday, 1 January");
  });
});

describe("schedulePill", () => {
  it("reads the day's label in the pill's case", () => {
    expect(schedulePill("FIXED · MON–SAT · 2h 00m PER DAY")).toBe(
      "Fixed · Mon–Sat",
    );
    expect(schedulePill("FIXED · MON, WED, FRI · 1h 30m PER DAY")).toBe(
      "Fixed · Mon, Wed, Fri",
    );
    expect(schedulePill("FLEXIBLE · 3 DAYS/WEEK · 1h 00m PER DAY")).toBe(
      "Flexible · 3 Days/week",
    );
    expect(schedulePill("FIXED")).toBe("Fixed");
  });
});

describe("summary", () => {
  it("rings today's planned time and says what is to go", () => {
    expect(
      summary(
        day({
          today_minutes: 280,
          week_minutes: 1460,
          extra_off_day_minutes: 90,
          today_planned_minutes: 360,
          today_to_go_minutes: 80,
        }),
      ),
    ).toEqual({
      ring: 78,
      total: "4h 40m",
      strong: "1h 20m to go",
      rest: " of 6h planned",
      dayOff: null,
      week: "24h 20m",
      extra: "1h 30m",
    });
  });

  it("is 0 % with nothing logged, and plan met when nothing is to go", () => {
    expect(
      summary(day({ today_planned_minutes: 360, today_to_go_minutes: 360 }))
        .ring,
    ).toBe(0);
    // Over on one objective never covers another: the day says 0 to go only
    // when every slot is met.
    expect(
      summary(
        day({
          today_minutes: 400,
          today_planned_minutes: 360,
          today_to_go_minutes: 0,
        }),
      ),
    ).toMatchObject({ ring: 100, strong: "plan met", rest: " for all 6h" });
  });

  it("a day off has no ring; once something is logged, all of it is extra", () => {
    expect(summary(day({}))).toMatchObject({
      ring: null,
      strong: null,
      dayOff: "Nothing is planned today. Anything you log counts as extra.",
    });
    expect(summary(day({ today_minutes: 45 }))).toMatchObject({
      ring: null,
      strong: "all of it extra",
      rest: ", nothing was planned",
      dayOff: null,
    });
  });
});

describe("card", () => {
  it("a planned card says what is to go, met, or over", () => {
    expect(card(objective({ logged_minutes: 100 }), DATE)).toEqual({
      kind: "planned",
      note: "20m to go",
      met: false,
      logged: "1h 40m",
      of: "2h 00m",
      progress: 100 / 120,
    });
    expect(card(objective({ logged_minutes: 120 }), DATE)).toMatchObject({
      note: "Planned time met",
      met: true,
      progress: 1,
    });
    expect(card(objective({ logged_minutes: 150 }), DATE)).toMatchObject({
      note: "Planned time met · +30m over",
      progress: 1,
    });
  });

  it("a planned slot with no target is full", () => {
    const o = objective();
    if (o.slot) o.slot.target_minutes = 0;
    expect(card(o, DATE)).toMatchObject({ progress: 1 });
  });

  it("not planned today: the next day, any extra, and Log anyway", () => {
    expect(card(offToday(), DATE)).toEqual({
      kind: "other",
      note: "Not planned today · next on Mon 7 Sep",
      canLog: true,
    });
    expect(card(offToday({ logged_minutes: 80 }), DATE)).toMatchObject({
      note: "Not planned today · next on Mon 7 Sep · 1h 20m extra today",
    });
  });

  it("starts later: its start as next on, and nothing to log (G44)", () => {
    expect(
      card(
        offToday({
          start_date: "2026-09-06",
          next_planned_date: "2026-09-07",
        }),
        DATE,
      ),
    ).toEqual({
      kind: "other",
      note: "Not planned today · next on Mon 7 Sep",
      canLog: false,
    });
    expect(
      card(
        offToday({ start_date: "2026-09-06", next_planned_date: null }),
        DATE,
      ),
    ).toMatchObject({ note: "Not planned today · next on Sun 6 Sep" });
  });

  it("started today, not planned today: it can still take time", () => {
    expect(card(offToday({ start_date: DATE }), DATE)).toMatchObject({
      canLog: true,
    });
  });

  it("the plan's last day is still in the plan; the day after, it has ended (G45)", () => {
    expect(
      card(offToday({ end_date: DATE, next_planned_date: null }), DATE),
    ).toEqual({
      kind: "other",
      note: "No planned day left · plan ends Sat 5 Sep",
      canLog: true,
    });
    expect(
      card(offToday({ end_date: "2026-09-04", next_planned_date: null }), DATE),
    ).toEqual({
      kind: "other",
      note: "Plan ended Fri 4 Sep · final review due",
      canLog: false,
    });
  });

  it("no planned day left before the end, with time logged anyway", () => {
    expect(
      card(
        offToday({
          end_date: "2026-09-09",
          next_planned_date: null,
          logged_minutes: 30,
        }),
        DATE,
      ),
    ).toMatchObject({
      note: "No planned day left · plan ends Wed 9 Sep · 30m extra today",
      canLog: true,
    });
  });

  it("old flexible data reads as not planned today (I-09)", () => {
    const flexible = objective({
      slot: {
        period_kind: "week",
        period_start: "2026-08-31",
        period_end: "2026-09-06",
        target_minutes: 300,
        target_days: 5,
      },
    });
    expect(card(flexible, DATE)).toMatchObject({ kind: "other", canLog: true });
  });
});

describe("loggable", () => {
  it("only inside the plan, both ends included (G44)", () => {
    expect(loggable(objective({ start_date: DATE }), DATE)).toBe(true);
    expect(loggable(objective({ end_date: DATE }), DATE)).toBe(true);
    expect(loggable(objective({ start_date: "2026-09-06" }), DATE)).toBe(false);
    expect(loggable(objective({ end_date: "2026-09-04" }), DATE)).toBe(false);
  });
});

describe("railRow", () => {
  it("names the band and the percentage", () => {
    expect(railRow(objective(), DATE)).toEqual({
      kind: "track",
      pill: "On track",
      tone: "ok",
      pct: 85,
    });
    expect(
      railRow(objective({ track: "at_risk", adherence_to_date: 63 }), DATE),
    ).toEqual({ kind: "track", pill: "At risk", tone: "risk", pct: 63 });
    expect(
      railRow(objective({ track: "behind", adherence_to_date: 40 }), DATE),
    ).toEqual({ kind: "track", pill: "Behind", tone: "behind", pct: 40 });
  });

  it("Day 1 and no percentage on the first day; Not started before it", () => {
    expect(railRow(objective({ start_date: DATE, track: null }), DATE)).toEqual(
      { kind: "label", text: "Day 1" },
    );
    expect(
      railRow(objective({ start_date: "2026-09-04", track: null }), DATE),
    ).toEqual({ kind: "label", text: "Day 2" });
    expect(railRow(objective({ start_date: "2026-09-06" }), DATE)).toEqual({
      kind: "label",
      text: "Not started",
    });
  });
});

describe("entryRows", () => {
  it("lists entries by start, with their span and compact minutes", () => {
    const entry = (id: string, start: string | undefined, minutes: number) => ({
      id,
      objective_id: "o1",
      local_date: DATE,
      tz: "Asia/Kolkata",
      minutes,
      note: `note ${id}`,
      link: null,
      logged_at: "2026-09-05T10:00:00Z",
      extra: false,
      ...(start ? { occurred_at_local: start } : {}),
    });
    const rows = entryRows(
      objective({
        entries: [
          entry("late", "14:00", 45),
          entry("early", "09:20", 60),
          entry("old", undefined, 30),
        ],
      }),
    );
    expect(rows).toEqual([
      { id: "old", time: "—", note: "note old", minutes: "30m" },
      { id: "early", time: "09:20–10:20", note: "note early", minutes: "1h" },
      { id: "late", time: "14:00–14:45", note: "note late", minutes: "45m" },
    ]);
    // Whichever side of the comparison the start-less entry falls on.
    expect(
      entryRows(
        objective({
          entries: [entry("old", undefined, 30), entry("early", "09:20", 60)],
        }),
      ).map((r) => r.id),
    ).toEqual(["old", "early"]);
  });
});
