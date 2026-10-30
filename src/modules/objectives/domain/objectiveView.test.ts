import { describe, expect, it } from "vitest";
import type { Figures, Objective } from "@/shared/contract";
import {
  banner,
  emptyLine,
  filters,
  footerLine,
  headPill,
  history,
  inFilter,
  planLine,
  row,
  scheduleLine,
  soFar,
} from "./objectiveView";

/** Sat 5 Sep 2026: day 14 of a 30-day plan from Sun 23 Aug. */
const TODAY = "2026-09-05";

const figures = (f: Partial<Figures> = {}): Figures => ({
  adherence_pct: 0,
  logged_minutes: 0,
  target_minutes: 0,
  planned_days: 0,
  target_met_days: 0,
  extra_off_day_minutes: 0,
  over_target_minutes: 0,
  ...f,
});

const schedule = {
  mode: "fixed" as const,
  planned_weekdays: [1, 2, 3, 4, 5, 6],
  minutes_per_planned_day: 120,
  label: "",
};

function objective(o: Partial<Objective> = {}): Objective {
  return {
    id: "o1",
    title: "Thesis draft",
    status: "active",
    status_since: "2026-08-22",
    schedule,
    start_date: "2026-08-23",
    end_date: "2026-09-21",
    next_review_on: null,
    reviews_due: 0,
    upcoming_review_on: "2026-08-30",
    figures: figures({ adherence_pct: 40 }),
    figures_to_date: figures({
      adherence_pct: 80,
      logged_minutes: 1240,
      target_minutes: 1440,
      planned_days: 12,
      target_met_days: 8,
      extra_off_day_minutes: 90,
      over_target_minutes: 30,
    }),
    track: "on_track",
    why_now: "w",
    success_criteria: "c",
    review_cadence: "weekly",
    segments: [
      {
        id: "s0",
        seq: 0,
        schedule,
        start_date: "2026-08-23",
        end_date: "2026-09-21",
        reason: "",
      },
    ],
    status_history: [{ occurred_on: "2026-08-22", change: "created" }],
    notes: [],
    last_logged_on: null,
    weeks: [],
    criteria_verdict: null,
    ...o,
  };
}

describe("scheduleLine and planLine", () => {
  it("reads the design's line, compact in the list", () => {
    expect(scheduleLine(schedule)).toBe("Fixed · Mon–Sat · 2h a day");
    expect(planLine(objective(), TODAY)).toBe(
      "Fixed · Mon–Sat · 2h a day · weekly reviews · Sun 23 Aug – Mon 21 Sep",
    );
  });

  it("writes every day, short lists, and a flexible plan", () => {
    const line = (planned_weekdays: number[]) =>
      scheduleLine({ ...schedule, planned_weekdays });
    expect(line([1, 2, 3, 4, 5, 6, 7])).toMatch(/^Fixed · Every day/);
    expect(line([5, 1, 3])).toMatch(/^Fixed · Mon, Wed, Fri/);
    expect(line([6, 7])).toMatch(/^Fixed · Sat, Sun/);
    expect(scheduleLine({ ...schedule, planned_weekdays: undefined })).toBe(
      "Fixed · 2h a day",
    );
    expect(
      scheduleLine({
        mode: "flexible",
        days_per_week: 5,
        minutes_per_planned_day: 240,
      }),
    ).toBe("Flexible · 5 days a week · 4h a day");
    expect(
      scheduleLine({ mode: "flexible", minutes_per_planned_day: 45 }),
    ).toBe("Flexible · 0 days a week · 45m a day");
  });

  it("leaves out a cadence it doesn't have", () => {
    expect(planLine({ ...objective(), review_cadence: undefined }, TODAY)).toBe(
      "Fixed · Mon–Sat · 2h a day · Sun 23 Aug – Mon 21 Sep",
    );
  });
});

describe("filters", () => {
  const all = [
    objective({ id: "a", start_date: "2026-08-01" }),
    objective({ id: "b", start_date: "2026-08-20" }),
    objective({ id: "c", status: "ended" }),
  ];

  it("counts every filter, empty ones included, in the design's order", () => {
    expect(filters(all)).toEqual([
      { id: "active", label: "Active", count: 2 },
      { id: "paused", label: "Paused", count: 0 },
      { id: "completed", label: "Completed", count: 0 },
      { id: "ended", label: "Terminated", count: 1 },
    ]);
  });

  it("lists a filter's objectives, the latest start first", () => {
    expect(inFilter(all, "active").map((o) => o.id)).toEqual(["b", "a"]);
    expect(inFilter(all, "paused")).toEqual([]);
  });

  it("says what an empty filter holds", () => {
    expect(emptyLine("active")).toBe("Nothing active.");
    expect(emptyLine("paused")).toBe("Nothing paused.");
    expect(emptyLine("completed")).toBe("Nothing completed.");
    expect(emptyLine("ended")).toBe("Nothing terminated.");
  });
});

describe("row and headPill: the design's state table", () => {
  it("running: Day 14 of 30, the to-date score and its band", () => {
    const o = objective();
    expect(row(o, TODAY)).toEqual({
      progress: 47,
      when: "Day 14 of 30",
      pill: { text: "80% · On track", tone: "ok" },
      due: null,
    });
    expect(headPill(o, TODAY)).toEqual({
      text: "Active · Day 14 of 30",
      tone: "accent",
    });
  });

  it("reads the band Today reads", () => {
    const at = (track: Objective["track"]) =>
      row(objective({ track }), TODAY).pill;
    expect(at("at_risk")).toEqual({ text: "80% · At risk", tone: "risk" });
    expect(at("behind")).toEqual({ text: "80% · Behind", tone: "behind" });
  });

  it("started today: no score yet", () => {
    const o = objective({
      start_date: TODAY,
      end_date: "2026-10-02",
      track: null,
    });
    expect(row(o, TODAY)).toMatchObject({
      when: "Day 1 of 28",
      pill: { text: "Day 1 · no score yet", tone: "neutral" },
    });
    expect(headPill(o, TODAY).text).toBe("Active · Day 1 of 28");
  });

  it("starts later: Not started, Starts on the head", () => {
    const o = objective({ start_date: "2026-09-06", end_date: "2026-10-03" });
    expect(row(o, TODAY)).toEqual({
      progress: 0,
      when: "Starts Sun 6 Sep",
      pill: { text: "Not started", tone: "neutral" },
      due: null,
    });
    expect(headPill(o, TODAY)).toEqual({
      text: "Starts Sun 6 Sep",
      tone: "neutral",
    });
  });

  it("plan ended, final review not saved", () => {
    const o = objective({
      start_date: "2026-08-10",
      end_date: "2026-09-04",
      reviews_due: 1,
    });
    const r = row(o, TODAY);
    expect(r).toMatchObject({
      progress: 100,
      when: "Ended Fri 4 Sep",
      pill: { text: "Plan ended · final review due", tone: "accent" },
      due: "1 review due",
    });
    expect(headPill(o, TODAY)).toEqual(r.pill);
    expect(row(objective({ reviews_due: 2 }), TODAY).due).toBe("2 reviews due");
  });

  it("paused", () => {
    const o = objective({ status: "paused", status_since: "2026-09-05" });
    expect(row(o, TODAY)).toMatchObject({
      when: "Day 14 of 30",
      pill: { text: "Paused", tone: "risk" },
    });
    expect(headPill(o, TODAY)).toEqual({
      text: "Paused since 5 Sep",
      tone: "risk",
    });
  });

  it("completed: months, weeks, and the whole run's score", () => {
    const o = objective({
      status: "completed",
      start_date: "2026-03-02",
      end_date: "2026-08-23",
      figures: figures({ adherence_pct: 84 }),
    });
    expect(row(o, TODAY)).toEqual({
      progress: 100,
      when: "Mar – Aug · 25 weeks",
      pill: { text: "Completed · 84%", tone: "ok" },
      due: null,
    });
    expect(headPill(o, TODAY)).toEqual(row(o, TODAY).pill);
  });

  it("terminated", () => {
    const o = objective({ status: "ended", status_since: "2026-09-05" });
    expect(row(o, TODAY)).toMatchObject({
      when: "Ended 5 Sep",
      pill: { text: "Terminated", tone: "behind" },
    });
    expect(headPill(o, TODAY)).toEqual({
      text: "Terminated 5 Sep",
      tone: "behind",
    });
  });
});

describe("soFar", () => {
  it("before the first day has passed, a line", () => {
    expect(soFar(objective({ start_date: TODAY }), TODAY)).toEqual({
      kind: "waiting",
      text: "It started today. Numbers appear once the first day has passed.",
    });
    expect(soFar(objective({ start_date: "2026-09-06" }), TODAY)).toEqual({
      kind: "waiting",
      text: "It starts Sun 6 Sep. Numbers appear once the first day has passed.",
    });
  });

  it("so far: the figures to date, with no over part", () => {
    expect(soFar(objective(), TODAY)).toEqual({
      kind: "figures",
      heading: "So far",
      range: "Sun 23 Aug – Sat 5 Sep · 14 of 30 days",
      ring: { pct: 80, tone: "ok" },
      tiles: [
        {
          label: "Logged effort",
          value: "20h 40m",
          hint: "of 24h 00m planned",
        },
        { label: "Targets met", value: "8 of 12", hint: "planned days" },
        { label: "Unplanned day effort", value: "1h 30m" },
      ],
    });
  });

  it("the whole plan once ended: the whole run's figures", () => {
    const ended = soFar(
      objective({ start_date: "2026-08-10", end_date: "2026-09-04" }),
      TODAY,
    );
    expect(ended).toMatchObject({
      heading: "The whole plan",
      range: "Mon 10 Aug – Fri 4 Sep · 26 of 26 days",
      ring: { pct: 40 },
    });
    const terminated = soFar(
      objective({ status: "ended", status_since: "2026-09-01", track: null }),
      TODAY,
    );
    expect(terminated).toMatchObject({
      heading: "The whole plan",
      range: "Sun 23 Aug – Tue 1 Sep · 10 of 30 days",
      ring: { pct: 40, tone: "neutral" },
    });
    expect(
      soFar(objective({ status: "completed", start_date: TODAY }), TODAY),
    ).toMatchObject({
      heading: "The whole plan",
      range: "Sat 5 Sep – Mon 21 Sep · 17 of 17 days",
    });
  });

  it("reads missing counts as none, and a ring at 0", () => {
    const bare = soFar(
      objective({
        figures_to_date: {
          adherence_pct: 0,
          logged_minutes: 0,
          target_minutes: 0,
        },
      }),
      TODAY,
    );
    expect(bare.kind === "figures" && bare.ring.pct).toBe(0);
    expect(bare.kind === "figures" && bare.tiles.map((t) => t.value)).toEqual([
      "0h 00m",
      "0 of 0",
      "0h 00m",
    ]);
  });
});

describe("banner and footerLine", () => {
  it("paused: since when, the reason word for word, the end date", () => {
    expect(
      banner(
        objective({
          status: "paused",
          status_since: "2026-09-05",
          status_history: [
            { occurred_on: "2026-08-22", change: "created" },
            { occurred_on: "2026-08-30", change: "paused", reason: "old" },
            { occurred_on: "2026-08-31", change: "resumed" },
            { occurred_on: "2026-09-05", change: "paused", reason: "Exams" },
          ],
        }),
        TODAY,
      ),
    ).toEqual({
      tone: "risk",
      title: "Paused since Sat 5 Sep",
      quote: "Exams",
      note: "The end date stays Mon 21 Sep. Paused days are not planned and not made up.",
    });
  });

  it("terminated and completed; none while active", () => {
    expect(
      banner(
        objective({
          status: "ended",
          status_since: "2026-09-05",
          status_history: [
            { occurred_on: "2026-09-05", change: "ended", reason: "Done" },
          ],
        }),
        TODAY,
      ),
    ).toEqual({
      tone: "behind",
      title: "Terminated Sat 5 Sep",
      quote: "Done",
      note: null,
    });
    expect(
      banner(objective({ status: "ended", status_since: TODAY }), TODAY)?.quote,
    ).toBeNull();
    expect(
      banner(objective({ status: "paused", status_since: TODAY }), TODAY)
        ?.quote,
    ).toBeNull();
    expect(
      banner(
        objective({ status: "completed", status_since: "2026-08-23" }),
        TODAY,
      ),
    ).toEqual({
      tone: "ok",
      title: "Completed Sun 23 Aug at the final review",
      quote: null,
      note: null,
    });
    expect(banner(objective(), TODAY)).toBeNull();
  });

  it("says the footer's words for each status", () => {
    expect(footerLine("active")).toBe(
      "Schedule and target are fixed. They change only when you extend at the final review.",
    );
    expect(footerLine("paused")).toBe(
      "Resume to plan days again. Terminating can't be undone.",
    );
    expect(footerLine("completed")).toBe(
      "This status is final. You can keep adding notes.",
    );
    expect(footerLine("ended")).toBe(footerLine("completed"));
  });
});

describe("history", () => {
  it("created, then started, newest first", () => {
    expect(history(objective(), TODAY)).toEqual([
      {
        date: "2026-08-23",
        dot: "active",
        label: "Active",
        text: "Started. Planned till Mon 21 Sep with weekly reviews.",
      },
      {
        date: "2026-08-22",
        dot: "created",
        label: "Created",
        text: "Fixed · Mon–Sat · 2h 00m a day · 30 days.",
      },
    ]);
  });

  it("has no Started row before the start, and weeks when they divide", () => {
    const later = history(
      objective({
        start_date: "2026-09-07",
        end_date: "2026-10-04",
        from_parking_lot: true,
        review_cadence: undefined,
        segments: [
          {
            id: "s0",
            seq: 0,
            schedule,
            start_date: "2026-09-07",
            end_date: "2026-10-04",
            reason: "",
          },
        ],
      }),
      TODAY,
    );
    expect(later).toEqual([
      {
        date: "2026-08-22",
        dot: "created",
        label: "Created",
        text: "From a parked idea. Fixed · Mon–Sat · 2h 00m a day · 4 weeks.",
      },
    ]);
  });

  it("one week, one day", () => {
    const one = (end: string) =>
      history(
        objective({
          start_date: "2026-09-07",
          segments: [
            {
              id: "s0",
              seq: 0,
              schedule,
              start_date: "2026-09-07",
              end_date: end,
              reason: "",
            },
          ],
        }),
        TODAY,
      )[0].text;
    expect(one("2026-09-13")).toMatch(/ · 1 week\.$/);
    expect(one("2026-09-07")).toMatch(/ · 1 day\.$/);
  });

  it("every event kind, in date order, newest first", () => {
    const extended = { ...schedule, planned_weekdays: [1, 2, 4, 5] };
    const rows = history(
      objective({
        status: "completed",
        criteria_verdict: "partly_met",
        segments: [
          objective().segments[0],
          {
            id: "s1",
            seq: 1,
            schedule: { ...extended, minutes_per_planned_day: 90 },
            start_date: "2026-09-22",
            end_date: "2026-09-25",
            reason: "More time",
          },
        ],
        status_history: [
          { occurred_on: "2026-08-22", change: "created" },
          { occurred_on: "2026-08-30", change: "paused", reason: "Ill" },
          { occurred_on: "2026-09-01", change: "resumed" },
          {
            occurred_on: "2026-09-22",
            change: "extended",
            reason: "More time",
            new_end_date: "2026-09-25",
          },
          { occurred_on: "2026-09-25", change: "completed" },
        ],
      }),
      "2026-09-26",
    );
    expect(rows.map((r) => [r.label, r.dot, r.text])).toEqual([
      [
        "Completed",
        "completed",
        "Completed at the final review. Success criteria: partly met.",
      ],
      [
        "Extended",
        "active",
        "Extended at the final review, now planned till Fri 25 Sep. Fixed · Mon, Tue, Thu, Fri · 1h 30m a day · weekly reviews.",
      ],
      ["Resumed", "active", null],
      ["Paused", "paused", "Ill"],
      [
        "Active",
        "active",
        "Started. Planned till Mon 21 Sep with weekly reviews.",
      ],
      ["Created", "created", "Fixed · Mon–Sat · 2h 00m a day · 30 days."],
    ]);
  });

  it("terminated, an extension without its segment, and no verdict", () => {
    const rows = history(
      objective({
        review_cadence: undefined,
        status_history: [
          { occurred_on: "2026-08-22", change: "created" },
          { occurred_on: "2026-09-22", change: "extended" },
          { occurred_on: "2026-09-23", change: "completed" },
          { occurred_on: "2026-09-24", change: "ended", reason: "Stop" },
        ],
      }),
      "2026-09-26",
    );
    expect(rows.slice(0, 3).map((r) => r.text)).toEqual([
      "Stop",
      "Completed at the final review.",
      "Extended at the final review, now planned till Mon 21 Sep.",
    ]);
    expect(rows[0]).toMatchObject({ dot: "terminated", label: "Terminated" });
  });

  it("an extension's segment without a cadence", () => {
    const rows = history(
      objective({
        review_cadence: undefined,
        segments: [
          objective().segments[0],
          {
            id: "s1",
            seq: 1,
            schedule,
            start_date: "2026-09-22",
            end_date: "2026-09-25",
            reason: "",
          },
        ],
        status_history: [
          { occurred_on: "2026-08-22", change: "created" },
          {
            occurred_on: "2026-09-22",
            change: "extended",
            new_end_date: "2026-09-25",
          },
        ],
      }),
      "2026-09-26",
    );
    expect(rows[0].text).toBe(
      "Extended at the final review, now planned till Fri 25 Sep. Fixed · Mon–Sat · 2h 00m a day.",
    );
  });
});
