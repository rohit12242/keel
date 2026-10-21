import { describe, expect, it } from "vitest";
import { planSlots } from "@/modules/objectives/domain/planSlots";
import type { SegmentForSlots } from "@/modules/objectives/domain/generateSlots";
import type { StatusEventRow } from "@/modules/objectives/domain/statusTimeline";
import {
  addMonths,
  dueWindows,
  periodKey,
  plannedDaysIn,
  reviewDueOn,
  reviewSchedule,
  reviewWindows,
} from "./reviewWindows";

/** docs/domain/review-windows.md — every worked example and named edge case. */
const seg = (start_date: string, end_date: string, id = "s0") => ({
  id,
  start_date,
  end_date,
});
const spans = (
  ws: { kind: string; period_start: string; period_end: string }[],
) =>
  ws.map(
    (w) => `${w.kind} ${w.period_start.slice(5)}…${w.period_end.slice(5)}`,
  );

describe("addMonths", () => {
  it("clamps a day the target month does not have, leap and not", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
    expect(addMonths("2026-05-10", 0)).toBe("2026-05-10");
  });
});

describe("reviewWindows", () => {
  it("21 days: two weeks, and a full last week that is the plan-end review", () => {
    expect(
      spans(reviewWindows("weekly", seg("2026-09-01", "2026-09-21"))),
    ).toEqual([
      "weekly 09-01…09-07",
      "weekly 09-08…09-14",
      "plan_end 09-15…09-21",
    ]);
  });

  it("30 days: four weeks and a two-day plan-end tail", () => {
    const w = reviewWindows("weekly", seg("2026-09-01", "2026-09-30"));
    expect(w).toHaveLength(5);
    expect(spans(w.slice(3))).toEqual([
      "weekly 09-22…09-28",
      "plan_end 09-29…09-30",
    ]);
    expect(w.map((x) => x.seq_in_seg)).toEqual([0, 1, 2, 3, 4]);
  });

  it("4 days: a single plan-end window, nothing numbered", () => {
    expect(
      spans(reviewWindows("weekly", seg("2026-09-01", "2026-09-04"))),
    ).toEqual(["plan_end 09-01…09-04"]);
    expect(
      spans(reviewWindows("weekly", seg("2026-09-01", "2026-09-01"))),
    ).toEqual(["plan_end 09-01…09-01"]);
  });

  it("monthly from 31 January: calendar months, clamped", () => {
    expect(
      spans(reviewWindows("monthly", seg("2026-01-31", "2026-04-15"))),
    ).toEqual([
      "monthly 01-31…02-27",
      "monthly 02-28…03-30",
      "plan_end 03-31…04-15",
    ]);
  });

  it("monthly with the end exactly on a boundary still ends in a plan-end review", () => {
    expect(
      spans(reviewWindows("monthly", seg("2026-01-01", "2026-02-28"))),
    ).toEqual(["monthly 01-01…01-31", "plan_end 02-01…02-28"]);
  });
});

describe("reviewSchedule", () => {
  it("numbers weeks on across an extension, each segment with its own End of plan", () => {
    const s = reviewSchedule("weekly", [
      seg("2026-09-01", "2026-09-21", "s0"),
      seg("2026-09-22", "2026-10-12", "s1"),
    ]);
    expect(s.map((w) => `${w.label} ${w.period_start.slice(5)}`)).toEqual([
      "Week 1 09-01",
      "Week 2 09-08",
      "End of plan 09-15",
      "Week 3 09-22",
      "Week 4 09-29",
      "End of plan 10-06",
    ]);
    expect(s.map((w) => w.segment_id)).toEqual([
      "s0",
      "s0",
      "s0",
      "s1",
      "s1",
      "s1",
    ]);
  });

  it("labels monthly windows as months", () => {
    expect(
      reviewSchedule("monthly", [seg("2026-01-01", "2026-03-15")]).map(
        (w) => w.label,
      ),
    ).toEqual(["Month 1", "Month 2", "End of plan"]);
  });
});

describe("dueWindows", () => {
  const plan: SegmentForSlots = {
    scheduleMode: "fixed",
    plannedWeekdays: [1, 2, 3, 4, 5],
    minutesPerPlannedDay: 60,
    startDate: "2026-09-07", // a Monday
    endDate: "2026-09-27",
  };
  const schedule = reviewSchedule("weekly", [
    seg(plan.startDate, plan.endDate),
  ]);
  const created: StatusEventRow[] = [
    { occurred_on: "2026-09-07", change: "created" },
  ];
  const due = (over: {
    today: string;
    events?: StatusEventRow[];
    saved?: string[];
    status?: "active" | "paused" | "completed" | "ended";
  }) =>
    dueWindows({
      schedule,
      today: over.today,
      status: over.status ?? "active",
      saved: new Set(over.saved ?? []),
      slots: planSlots([plan], over.events ?? created),
    }).map((w) => w.period_end);

  it("is due on its period_end, not the day before", () => {
    expect(due({ today: "2026-09-12" })).toEqual([]);
    expect(due({ today: "2026-09-13" })).toEqual(["2026-09-13"]);
  });

  it("lists every closed unsaved window, earliest first", () => {
    expect(due({ today: "2026-09-21" })).toEqual(["2026-09-13", "2026-09-20"]);
    expect(
      due({ today: "2026-09-21", saved: [periodKey(schedule[0])] }),
    ).toEqual(["2026-09-20"]);
  });

  it("skips a window with no planned day — a fully paused week", () => {
    const events: StatusEventRow[] = [
      ...created,
      { occurred_on: "2026-09-14", change: "paused" },
      { occurred_on: "2026-09-21", change: "resumed" },
    ];
    expect(due({ today: "2026-09-27", events })).toEqual([
      "2026-09-13",
      "2026-09-27",
    ]);
  });

  it("still asks for a partly paused week", () => {
    const events: StatusEventRow[] = [
      ...created,
      { occurred_on: "2026-09-16", change: "paused" },
      { occurred_on: "2026-09-19", change: "resumed" },
    ];
    expect(due({ today: "2026-09-21", events })).toEqual([
      "2026-09-13",
      "2026-09-20",
    ]);
  });

  it("surfaces nothing while paused, completed or ended", () => {
    for (const status of ["paused", "completed", "ended"] as const) {
      expect(due({ today: "2026-09-30", status })).toEqual([]);
    }
  });
});

describe("plannedDaysIn", () => {
  it("counts the active planned days inside the window only", () => {
    const slots = planSlots(
      [
        {
          scheduleMode: "fixed",
          plannedWeekdays: [1, 3, 5],
          minutesPerPlannedDay: 30,
          startDate: "2026-09-07",
          endDate: "2026-09-20",
        },
      ],
      [{ occurred_on: "2026-09-07", change: "created" }],
    );
    expect(
      plannedDaysIn(
        { period_start: "2026-09-07", period_end: "2026-09-13" },
        slots,
      ),
    ).toBe(3);
    expect(
      plannedDaysIn(
        { period_start: "2026-09-21", period_end: "2026-09-27" },
        slots,
      ),
    ).toBe(0);
  });
});

describe("reviewDueOn — the review that will judge a date (G33)", () => {
  const weekly = {
    cadence: "weekly" as const,
    segments: [{ id: "s0", start_date: "2026-09-01", end_date: "2026-09-21" }],
  };

  it("is the end of the window the date falls in", () => {
    expect(reviewDueOn("2026-09-10", [weekly])).toBe("2026-09-14"); // Week 2
    expect(reviewDueOn("2026-09-14", [weekly])).toBe("2026-09-14");
    expect(reviewDueOn("2026-09-21", [weekly])).toBe("2026-09-21"); // End of plan
  });

  it("takes the earlier end across the objectives a date names", () => {
    const monthly = {
      cadence: "monthly" as const,
      segments: [
        { id: "m0", start_date: "2026-08-20", end_date: "2026-12-19" },
      ],
    };
    expect(reviewDueOn("2026-09-10", [monthly])).toBe("2026-09-19");
    expect(reviewDueOn("2026-09-10", [monthly, weekly])).toBe("2026-09-14");
  });

  it("clamps a monthly window at a month's end", () => {
    const fromJan31 = {
      cadence: "monthly" as const,
      segments: [{ id: "j", start_date: "2026-01-31", end_date: "2026-06-30" }],
    };
    expect(reviewDueOn("2026-02-10", [fromJan31])).toBe("2026-02-27");
  });

  it("is null when no window covers the date", () => {
    expect(reviewDueOn("2026-08-31", [weekly])).toBeNull();
    expect(reviewDueOn("2026-09-10", [])).toBeNull();
  });
});
