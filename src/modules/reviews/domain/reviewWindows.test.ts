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
  upcomingReviewOn,
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
  it("Mon to Sun, 21 days: two weeks, and a full last week that is the plan-end review", () => {
    expect(
      spans(reviewWindows("weekly", seg("2026-09-07", "2026-09-27"))),
    ).toEqual([
      "weekly 09-07…09-13",
      "weekly 09-14…09-20",
      "plan_end 09-21…09-27",
    ]);
  });

  it("Thu to Wed: a 4-day first week stands; a 3-day tail joins the week before", () => {
    const w = reviewWindows("weekly", seg("2026-09-03", "2026-09-30"));
    expect(spans(w)).toEqual([
      "weekly 09-03…09-06",
      "weekly 09-07…09-13",
      "weekly 09-14…09-20",
      "plan_end 09-21…09-30",
    ]);
    expect(w.map((x) => x.seq_in_seg)).toEqual([0, 1, 2, 3]);
  });

  it("Sat to Fri: a 2-day first week joins the next; a 5-day last week stands", () => {
    const w = reviewWindows("weekly", seg("2026-09-05", "2026-10-02"));
    expect(spans(w)).toEqual([
      "weekly 09-05…09-13",
      "weekly 09-14…09-20",
      "weekly 09-21…09-27",
      "plan_end 09-28…10-02",
    ]);
    expect(w.map((x) => x.seq_in_seg)).toEqual([0, 1, 2, 3]);
  });

  it("Sat to Tue: two short weeks join into one plan-end window", () => {
    expect(
      spans(reviewWindows("weekly", seg("2026-09-05", "2026-09-08"))),
    ).toEqual(["plan_end 09-05…09-08"]);
  });

  it("a segment shorter than a week, or of one day, is a single plan-end window", () => {
    expect(
      spans(reviewWindows("weekly", seg("2026-09-08", "2026-09-11"))),
    ).toEqual(["plan_end 09-08…09-11"]);
    expect(
      spans(reviewWindows("weekly", seg("2026-09-01", "2026-09-01"))),
    ).toEqual(["plan_end 09-01…09-01"]);
  });

  it("from every start weekday, weeks end on Sundays and a 1–3-day first week joins", () => {
    const firstEnd = ["2026-09-13", "2026-09-13", "2026-09-13", "2026-09-13"];
    firstEnd.push("2026-09-20", "2026-09-20", "2026-09-20");
    for (let d = 0; d < 7; d++) {
      const start = `2026-09-${String(7 + d).padStart(2, "0")}`; // Mon … Sun
      const w = reviewWindows("weekly", seg(start, "2026-10-11"));
      expect(w[0].period_start).toBe(start);
      expect(w[0].period_end).toBe(firstEnd[d]);
      for (const x of w) {
        expect(new Date(`${x.period_end}T00:00:00Z`).getUTCDay()).toBe(0);
      }
    }
  });

  it("a last week of 1–3 days joins the week before; of 4 it stands", () => {
    const last = (end: string) =>
      spans(reviewWindows("weekly", seg("2026-09-07", end))).at(-1);
    expect(last("2026-09-21")).toBe("plan_end 09-14…09-21");
    expect(last("2026-09-23")).toBe("plan_end 09-14…09-23");
    expect(last("2026-09-24")).toBe("plan_end 09-21…09-24");
  });

  it("monthly from the 10th: calendar months, a 9-day last month joined", () => {
    expect(
      spans(reviewWindows("monthly", seg("2026-09-10", "2026-12-09"))),
    ).toEqual([
      "monthly 09-10…09-30",
      "monthly 10-01…10-31",
      "plan_end 11-01…12-09",
    ]);
  });

  it("a first month of 12 or 14 days joins the next; of 15 it stands", () => {
    expect(
      spans(reviewWindows("monthly", seg("2027-01-20", "2027-04-30"))),
    ).toEqual([
      "monthly 01-20…02-28",
      "monthly 03-01…03-31",
      "plan_end 04-01…04-30",
    ]);
    expect(
      spans(reviewWindows("monthly", seg("2026-09-17", "2026-11-30")))[0],
    ).toBe("monthly 09-17…10-31");
    expect(
      spans(reviewWindows("monthly", seg("2026-09-16", "2026-11-30")))[0],
    ).toBe("monthly 09-16…09-30");
  });

  it("a last month of 14 days joins the one before; of 15 it stands", () => {
    expect(
      spans(reviewWindows("monthly", seg("2026-09-01", "2026-11-14"))),
    ).toEqual(["monthly 09-01…09-30", "plan_end 10-01…11-14"]);
    expect(
      spans(reviewWindows("monthly", seg("2026-09-01", "2026-11-15"))),
    ).toEqual([
      "monthly 09-01…09-30",
      "monthly 10-01…10-31",
      "plan_end 11-01…11-15",
    ]);
  });

  it("February ends on its last day, leap year and not", () => {
    expect(
      spans(reviewWindows("monthly", seg("2027-02-01", "2027-03-31"))),
    ).toEqual(["monthly 02-01…02-28", "plan_end 03-01…03-31"]);
    expect(
      spans(reviewWindows("monthly", seg("2028-02-01", "2028-03-31"))),
    ).toEqual(["monthly 02-01…02-29", "plan_end 03-01…03-31"]);
  });

  it("monthly with the end exactly on a boundary still ends in a plan-end review", () => {
    expect(
      spans(reviewWindows("monthly", seg("2026-01-01", "2026-02-28"))),
    ).toEqual(["monthly 01-01…01-31", "plan_end 02-01…02-28"]);
  });

  it("always tiles the segment, ends on calendar boundaries, and joins every short period", () => {
    const sunday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay() === 0;
    const monthEnd = (d: string) =>
      new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).getUTCDate() === 1;
    const days = (w: { period_start: string; period_end: string }) =>
      (Date.parse(w.period_end) - Date.parse(w.period_start)) / 86_400_000 + 1;
    for (const cadence of ["weekly", "monthly"] as const) {
      const [short, longest, onBoundary] =
        cadence === "weekly" ? [4, 10, sunday] : [15, 45, monthEnd];
      for (let s = 0; s < 40; s++) {
        const start = new Date(Date.UTC(2027, 11, 1) + s * 86_400_000)
          .toISOString()
          .slice(0, 10);
        for (let len = 1; len <= 130; len += 3) {
          const end = new Date(Date.parse(start) + (len - 1) * 86_400_000)
            .toISOString()
            .slice(0, 10);
          const w = reviewWindows(cadence, seg(start, end));
          expect(w[0].period_start).toBe(start);
          expect(w.at(-1)?.period_end).toBe(end);
          w.forEach((x, k) => {
            expect(x.seq_in_seg).toBe(k);
            expect(x.kind).toBe(k === w.length - 1 ? "plan_end" : cadence);
            // A lone window is the whole segment, whatever its length.
            if (w.length > 1) {
              expect(days(x)).toBeLessThanOrEqual(longest);
              expect(days(x)).toBeGreaterThanOrEqual(short);
            }
            if (k > 0) {
              expect(Date.parse(x.period_start)).toBe(
                Date.parse(w[k - 1].period_end) + 86_400_000,
              );
            }
            if (k < w.length - 1) expect(onBoundary(x.period_end)).toBe(true);
          });
        }
      }
    }
  });
});

describe("reviewSchedule", () => {
  it("numbers weeks on across an extension, each segment with its own End of plan", () => {
    const s = reviewSchedule("weekly", [
      seg("2026-09-07", "2026-09-27", "s0"),
      seg("2026-09-28", "2026-10-14", "s1"),
    ]);
    expect(
      s.map(
        (w) => `${w.label} ${w.period_start.slice(5)}…${w.period_end.slice(5)}`,
      ),
    ).toEqual([
      "Week 1 09-07…09-13",
      "Week 2 09-14…09-20",
      "End of plan 09-21…09-27",
      "Week 3 09-28…10-04",
      "End of plan 10-05…10-14",
    ]);
    expect(s.map((w) => w.segment_id)).toEqual(["s0", "s0", "s0", "s1", "s1"]);
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
    segments: [{ id: "s0", start_date: "2026-09-07", end_date: "2026-09-27" }],
  };

  it("is the end of the window the date falls in", () => {
    expect(reviewDueOn("2026-09-16", [weekly])).toBe("2026-09-20"); // Week 2
    expect(reviewDueOn("2026-09-20", [weekly])).toBe("2026-09-20");
    expect(reviewDueOn("2026-09-27", [weekly])).toBe("2026-09-27"); // End of plan
  });

  it("takes the earlier end across the objectives a date names", () => {
    const monthly = {
      cadence: "monthly" as const,
      segments: [
        { id: "m0", start_date: "2026-08-20", end_date: "2026-12-19" },
      ],
    };
    // The 12 days of August join September.
    expect(reviewDueOn("2026-08-25", [monthly])).toBe("2026-09-30");
    expect(reviewDueOn("2026-09-16", [monthly])).toBe("2026-09-30");
    expect(reviewDueOn("2026-09-16", [monthly, weekly])).toBe("2026-09-20");
  });

  it("is null when no window covers the date", () => {
    expect(reviewDueOn("2026-09-06", [weekly])).toBeNull();
    expect(reviewDueOn("2026-09-10", [])).toBeNull();
  });
});

describe("upcomingReviewOn — the next review, due or not (G34)", () => {
  const segment = {
    id: "s0",
    start_date: "2026-09-07",
    end_date: "2026-09-27",
  };
  const PLAN: SegmentForSlots = {
    scheduleMode: "fixed",
    plannedWeekdays: [1, 2, 3, 4, 5, 6, 7],
    minutesPerPlannedDay: 60,
    startDate: "2026-09-07",
    endDate: "2026-09-27",
  };
  const created: StatusEventRow[] = [
    { occurred_on: "2026-09-07", change: "created" },
  ];
  const upcoming = (
    over: Partial<Parameters<typeof upcomingReviewOn>[0]> = {},
  ) =>
    upcomingReviewOn({
      schedule: reviewSchedule("weekly", [segment]),
      today: "2026-09-09",
      status: "active",
      saved: new Set(),
      slots: planSlots([PLAN], created),
      ...over,
    });

  it("is Week 1's end before anything is due", () => {
    expect(upcoming()).toBe("2026-09-13");
  });

  it("moves on once a window is saved", () => {
    expect(
      upcoming({
        today: "2026-09-14",
        saved: new Set([
          periodKey({ period_start: "2026-09-07", period_end: "2026-09-13" }),
        ]),
      }),
    ).toBe("2026-09-20");
  });

  it("skips a window that closed with no planned day", () => {
    const pausedWeek1: StatusEventRow[] = [
      ...created,
      { occurred_on: "2026-09-07", change: "paused" },
      { occurred_on: "2026-09-14", change: "resumed" },
    ];
    expect(
      upcoming({ today: "2026-09-15", slots: planSlots([PLAN], pausedWeek1) }),
    ).toBe("2026-09-20");
  });

  it("still shows one while paused, and none once completed or ended", () => {
    expect(upcoming({ status: "paused" })).toBe("2026-09-13");
    expect(upcoming({ status: "completed" })).toBeNull();
    expect(upcoming({ status: "ended" })).toBeNull();
  });

  it("is null once every window is saved", () => {
    const all = reviewSchedule("weekly", [segment]);
    expect(
      upcoming({ today: "2026-09-27", saved: new Set(all.map(periodKey)) }),
    ).toBeNull();
  });
});
