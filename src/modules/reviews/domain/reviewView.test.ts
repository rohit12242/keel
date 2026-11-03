import { describe, expect, it } from "vitest";
import type {
  Deviation,
  DueReview,
  Review,
  ReviewSummary,
  ScheduleDay,
} from "@/shared/contract";
import {
  adherenceTone,
  cardTitles,
  changeSetIn,
  nothingToCheck,
  BAR_MAX,
  checkedIn,
  chosenCard,
  dayBars,
  draftPill,
  dueBanner,
  dueCards,
  emptyLine,
  FINAL_LATER,
  IMPROVEMENT,
  IMPROVEMENT_ORDER,
  monthWeeks,
  neighbours,
  periodRange,
  reviewHead,
  savedList,
  stamp,
  tabCount,
  tiles,
  titleOf,
  unitOf,
  VERDICT,
  VERDICT_ORDER,
} from "./reviewView";

const TODAY = "2026-09-08";
const TZ = "Asia/Kolkata";

const summary = (over: Partial<ReviewSummary> = {}): ReviewSummary => ({
  id: "r1",
  kind: "weekly",
  label: "Week 1",
  period_start: "2026-08-24",
  period_end: "2026-08-30",
  status: "saved",
  saved_at: "2026-08-30T13:40:00Z",
  last_saved_at: "2026-08-30T13:40:00Z",
  outcome: null,
  review_summary: null,
  what_changes_next: "Hardest first.",
  adherence_pct: 84,
  ...over,
});

const due = (over: Partial<DueReview> = {}): DueReview => ({
  label: "Week 2",
  kind: "weekly",
  period_start: "2026-08-31",
  period_end: "2026-09-06",
  review_id: null,
  ...over,
});

const deviation = (over: Partial<Deviation> = {}): Deviation => ({
  id: "d1",
  objective_ids: ["o"],
  local_date: "2026-09-02",
  tz: TZ,
  kind: "chosen",
  what_happened: "Helped a friend move",
  reasoning: "Once a year.",
  minutes: 90,
  pattern_id: null,
  pattern_name: null,
  verdict: null,
  verdict_review_id: null,
  pattern_nth: null,
  review_due_on: "2026-09-06",
  ...over,
});

const review = (over: Partial<Review> = {}): Review => ({
  ...summary({
    id: "r2",
    label: "Week 2",
    period_start: "2026-08-31",
    period_end: "2026-09-06",
    status: "draft",
    saved_at: null,
    last_saved_at: null,
    what_changes_next: null,
  }),
  objective_id: "o",
  due_on: "2026-09-06",
  improvement_answer: null,
  improvement_answer_note: null,
  what_worked: null,
  what_got_in_the_way: null,
  criteria_assessment: null,
  criteria_verdict: null,
  previous_review_id: null,
  previous_what_changes_next: null,
  figures: {
    adherence_pct: 75,
    logged_minutes: 625,
    target_minutes: 720,
    planned_days: 6,
    target_met_days: 3,
    extra_off_day_minutes: 40,
    over_target_minutes: 30,
  },
  minutes_per_day: [],
  deviations: [],
  parked_ideas: [],
  ...over,
});

describe("the words every place shares", () => {
  it("writes a period within a month, across one, and of one day", () => {
    expect(periodRange("2026-08-24", "2026-08-30", TODAY)).toBe(
      "Mon 24 – Sun 30 Aug",
    );
    expect(periodRange("2026-08-31", "2026-09-06", TODAY)).toBe(
      "Mon 31 Aug – Sun 6 Sep",
    );
    expect(periodRange("2026-09-06", "2026-09-06", TODAY)).toBe("Sun 6 Sep");
  });

  it("writes an instant in the user's zone, with or without the weekday", () => {
    expect(stamp("2026-09-05T13:10:00Z", TZ, TODAY)).toBe("5 Sep, 18:40");
    expect(stamp("2026-08-30T13:40:00Z", TZ, TODAY, true)).toBe(
      "Sun 30 Aug, 19:10",
    );
  });

  it("names a review and its unit", () => {
    expect(titleOf({ kind: "weekly", label: "Week 2" })).toBe("Week 2 review");
    expect(titleOf({ kind: "plan_end", label: "End of plan" })).toBe(
      "Final review",
    );
    expect(unitOf("monthly")).toBe("month");
    expect(unitOf("weekly")).toBe("week");
  });

  it("colours adherence by its band, or not at all without one", () => {
    expect(adherenceTone(84)).toBe("ok");
    expect(adherenceTone(65)).toBe("risk");
    expect(adherenceTone(10)).toBe("behind");
    expect(adherenceTone(null)).toBe("neutral");
  });

  it("has every answer and verdict in the design's words and order", () => {
    expect(IMPROVEMENT_ORDER.map((a) => IMPROVEMENT[a])).toEqual([
      "Worked",
      "Partly",
      "Didn't work",
      "Didn't try it",
    ]);
    expect(VERDICT_ORDER.map((v) => VERDICT[v])).toEqual([
      "It held",
      "It didn't hold",
    ]);
  });
});

describe("the cards' words", () => {
  it("titles the cards as asked, and as answered", () => {
    expect(cardTitles("weekly", false)).toEqual({
      numbers: "The week in numbers",
      change: "Did last week's change work?",
      chosen: "Chosen deviations",
      reflect: "Reflect",
    });
    expect(cardTitles("monthly", true)).toMatchObject({
      numbers: "The month in numbers",
      change: "Last month's change",
    });
  });

  it("says which review set the change, even when it couldn't be read", () => {
    expect(changeSetIn({ kind: "weekly", label: "Week 1" }, false)).toBe(
      "The change you set in the week 1 review",
    );
    expect(changeSetIn(null, true)).toBe("Set in your last review");
    expect(nothingToCheck(false)).toBe(
      "First review of this objective, so there is no earlier change to check.",
    );
    expect(nothingToCheck(true)).toContain("there was no earlier change");
  });
});

describe("the Reviews tab", () => {
  it("opens only the first due review, and the rest wait", () => {
    const cards = dueCards(
      [
        due(),
        due({
          label: "Week 3",
          period_start: "2026-09-07",
          period_end: "2026-09-13",
        }),
      ],
      [],
      TZ,
      TODAY,
    );
    expect(cards).toEqual([
      {
        key: "2026-08-31/2026-09-06",
        title: "Week 2 review",
        period: "Mon 31 Aug – Sun 6 Sep",
        draft: false,
        edited: null,
        action: { kind: "start" },
      },
      expect.objectContaining({
        title: "Week 3 review",
        action: { kind: "wait", text: "Opens after Week 2" },
      }),
    ]);
  });

  it("continues a written draft, and starts one never written", () => {
    const written = summary({
      id: "r2",
      status: "draft",
      saved_at: null,
      last_saved_at: "2026-09-05T13:10:00Z",
    });
    const [card] = dueCards([due({ review_id: "r2" })], [written], TZ, TODAY);
    expect(card).toMatchObject({
      draft: true,
      edited: "last edited 5 Sep, 18:40",
      action: { kind: "continue", reviewId: "r2" },
    });
    const opened = { ...written, last_saved_at: null };
    expect(
      dueCards([due({ review_id: "r2" })], [opened], TZ, TODAY)[0].action,
    ).toEqual({ kind: "start" });
    expect(
      dueCards([due({ review_id: "gone" })], [], TZ, TODAY)[0].action,
    ).toEqual({ kind: "start" });
  });

  it("shows a due final review with no way to open it yet", () => {
    const [card] = dueCards(
      [
        due({
          kind: "plan_end",
          label: "End of plan",
          period_start: "2026-08-10",
          period_end: "2026-09-04",
        }),
      ],
      [],
      TZ,
      TODAY,
    );
    expect(card).toMatchObject({
      title: "Final review",
      period: "The whole plan · ended Fri 4 Sep",
      action: { kind: "later", text: FINAL_LATER },
    });
  });

  it("counts saved reviews only, and says when the first is due", () => {
    expect(tabCount([summary(), summary({ id: "r2", status: "draft" })])).toBe(
      1,
    );
    expect(emptyLine("2026-08-30", TODAY)).toBe(
      "No reviews yet. The first one is due Sun 30 Aug.",
    );
    expect(emptyLine(null, TODAY)).toBe("No reviews yet.");
  });

  it("lists saved reviews newest first, with the change each set", () => {
    const list = savedList(
      [
        summary(),
        summary({
          id: "r2",
          label: "Week 2",
          period_start: "2026-08-31",
          period_end: "2026-09-06",
          what_changes_next: null,
          adherence_pct: null,
          saved_at: "2026-09-06T13:40:00Z",
        }),
        summary({ id: "rd", status: "draft" }),
      ],
      TZ,
      TODAY,
      false,
    );
    expect(list.count).toBe(2);
    expect(list.hidden).toBe(0);
    expect(list.groups).toHaveLength(1);
    expect(list.groups[0].heading).toBeNull();
    expect(list.groups[0].rows).toEqual([
      {
        id: "r2",
        title: "Week 2 · Mon 31 Aug – Sun 6 Sep",
        final: false,
        sub: null,
        pct: null,
        pctText: "—",
        tone: "neutral",
        saved: "6 Sep",
      },
      {
        id: "r1",
        title: "Week 1 · Mon 24 – Sun 30 Aug",
        final: false,
        sub: "Change: “Hardest first.”",
        pct: 84,
        pctText: "84%",
        tone: "ok",
        saved: "30 Aug",
      },
    ]);
  });

  it("shows a final review's outcome, or its change when it has none", () => {
    const [done, open] = savedList(
      [
        summary({
          id: "f",
          kind: "plan_end",
          label: "End of plan",
          outcome: "completed",
        }),
        summary({
          id: "g",
          kind: "plan_end",
          label: "End of plan",
          period_start: "2026-09-01",
          outcome: null,
        }),
      ],
      TZ,
      TODAY,
      false,
    ).groups[0].rows.reverse();
    expect(done).toMatchObject({
      title: "Final review · whole plan",
      final: true,
      sub: "Outcome: completed",
    });
    expect(open.sub).toBe("Change: “Hardest first.”");
  });

  it("groups more than 8 by month and holds the rest back", () => {
    const many = Array.from({ length: 10 }, (_, i) => {
      const start = new Date(Date.UTC(2025, 11, 1 + i * 7));
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const end = new Date(start.getTime() + 6 * 86_400_000);
      return summary({
        id: `r${i}`,
        label: `Week ${i + 1}`,
        period_start: iso(start),
        period_end: iso(end),
      });
    });
    const short = savedList(many, TZ, TODAY, false);
    expect(short.count).toBe(10);
    expect(short.hidden).toBe(2);
    expect(short.groups.map((g) => [g.heading, g.rows.length])).toEqual([
      ["February", 2],
      ["January", 4],
      ["December 2025", 2],
    ]);
    const all = savedList(many, TZ, TODAY, true);
    expect(all.hidden).toBe(0);
    expect(all.groups.at(-1)).toMatchObject({ heading: "December 2025" });
    expect(all.groups.at(-1)?.rows).toHaveLength(4);
  });
});

describe("the due banner", () => {
  it("is absent with nothing due", () => {
    expect(dueBanner([], [], TODAY)).toBeNull();
  });

  it("names the oldest, how many wait, and whether a draft is saved", () => {
    expect(dueBanner([due()], [], TODAY)).toEqual({
      title: "Week 2 review is due",
      sub: "1 review due",
      action: { kind: "start" },
    });
    const written = summary({
      id: "r2",
      status: "draft",
      last_saved_at: "2026-09-05T13:10:00Z",
    });
    expect(
      dueBanner(
        [due({ review_id: "r2" }), due({ label: "Week 3" })],
        [written],
        TODAY,
      ),
    ).toEqual({
      title: "Week 2 review is due",
      sub: "2 reviews due · draft saved",
      action: { kind: "continue", reviewId: "r2" },
    });
  });

  it("says when the plan ended for a final review", () => {
    expect(
      dueBanner(
        [
          due({
            kind: "plan_end",
            label: "End of plan",
            period_end: "2026-09-04",
          }),
        ],
        [],
        TODAY,
      ),
    ).toEqual({
      title: "Final review is due",
      sub: "1 review due · the plan ended Fri 4 Sep",
      action: { kind: "later", text: FINAL_LATER },
    });
  });
});

describe("the review page", () => {
  const o = {
    title: "Python and DSA",
    schedule: {
      mode: "fixed" as const,
      planned_weekdays: [1, 2, 3, 4, 5, 6],
      minutes_per_planned_day: 120,
      label: "",
    },
    start_date: "2026-08-10",
  };

  it("heads a final review over the whole plan", () => {
    expect(
      reviewHead(
        review({
          kind: "plan_end",
          label: "End of plan",
          period_start: "2026-08-31",
          period_end: "2026-09-04",
        }),
        o,
        TZ,
        TODAY,
      ),
    ).toMatchObject({
      title: "Final review",
      sub: "Mon 10 Aug – Fri 4 Sep · the whole plan · Python and DSA",
    });
  });

  it("heads a draft not yet written, a written one, and a saved one", () => {
    expect(reviewHead(review(), o, TZ, TODAY)).toEqual({
      title: "Week 2 review",
      sub: "Mon 31 Aug – Sun 6 Sep · Python and DSA",
      pill: { text: "Due Sun 6 Sep", tone: "accent" },
    });
    expect(
      reviewHead(
        review({ last_saved_at: "2026-09-05T13:10:00Z" }),
        o,
        TZ,
        TODAY,
      ).pill,
    ).toEqual({ text: "Draft saved · 5 Sep, 18:40", tone: "neutral" });
    expect(
      reviewHead(
        review({ status: "saved", saved_at: "2026-09-06T13:40:00Z" }),
        o,
        TZ,
        TODAY,
      ),
    ).toEqual({
      title: "Week 2 review",
      sub: "Mon 31 Aug – Sun 6 Sep · Python and DSA · Fixed · Mon–Sat · 2h a day",
      pill: { text: "Saved Sun 6 Sep, 19:10", tone: "neutral" },
    });
    expect(draftPill("2026-09-05T13:10:00Z", TZ, TODAY)).toBe(
      "Draft saved · 5 Sep, 18:40",
    );
  });

  it("gives five tiles with no comparison for a first review", () => {
    const t = tiles(review({ deviations: [deviation()] }), null);
    expect(t.hint).toBeNull();
    expect(t.tiles).toEqual([
      { label: "Adherence", value: "75%", hint: null, tone: "risk" },
      {
        label: "Logged",
        value: "10h 25m",
        hint: "of 12h 00m planned · +30m over",
        tone: null,
      },
      { label: "Targets met", value: "3 of 6", hint: null, tone: null },
      {
        label: "Deviation time",
        value: "1h 30m",
        hint: null,
        tone: "deviation",
      },
      { label: "Extra, off days", value: "0h 40m", hint: null, tone: null },
    ]);
  });

  it("compares with the previous saved review, and names it", () => {
    const previous = review({
      id: "r1",
      label: "Week 1",
      figures: { adherence_pct: 90, logged_minutes: 0, target_minutes: 0 },
    });
    const t = tiles(
      review({
        figures: { adherence_pct: 0, logged_minutes: 0, target_minutes: 60 },
      }),
      previous,
    );
    expect(t.hint).toBe("Week 1 for comparison");
    expect(t.tiles.map((x) => [x.value, x.hint, x.tone])).toEqual([
      ["0%", "90% in week 1", "behind"],
      ["0h 00m", "of 1h 00m planned", null],
      ["0 of 0", "0 of 0 in week 1", null],
      ["0h 00m", "0h 00m in week 1", null],
      ["0h 00m", "0h 00m in week 1", null],
    ]);
  });

  const day = (date: string, over: Partial<ScheduleDay>): ScheduleDay => ({
    date,
    state: "off_day",
    segment_id: "s",
    ...over,
  });

  it("draws a bar for every state, from the grid", () => {
    const grid = [
      day("2026-08-31", {
        state: "target_met",
        logged_minutes: 120,
        target_minutes: 120,
      }),
      day("2026-09-01", {
        state: "target_met",
        logged_minutes: 150,
        target_minutes: 120,
      }),
      day("2026-09-02", {
        state: "worked_short",
        logged_minutes: 45,
        target_minutes: 120,
      }),
      day("2026-09-03", {
        state: "planned_no_log",
        logged_minutes: 0,
        target_minutes: 120,
      }),
      day("2026-09-04", {
        state: "off_day_worked",
        logged_minutes: 600,
        target_minutes: 0,
      }),
      day("2026-09-05", {
        state: "worked_short",
        logged_minutes: 1,
        target_minutes: 120,
      }),
      // Sunday is missing from the grid: an off day with nothing.
    ];
    const b = dayBars(grid, {
      period_start: "2026-08-31",
      period_end: "2026-09-06",
    });
    expect(b.target).toBe("2h");
    expect(
      b.bars.map((x) => [x.day, x.value, x.style, x.height, x.word, x.tone]),
    ).toEqual([
      ["Mon 31", "2h", "met", 64, "✓ Met", "ok"],
      ["Tue 1", "2h 30m", "met", 80, "✓ +30m", "ok"],
      ["Wed 2", "45m", "short", 24, "− 1h 15m", "risk"],
      ["Thu 3", "0m", "missed", 3, "✕ Missed", "behind"],
      ["Fri 4", "10h", "extra", BAR_MAX, "+ Extra", "ok"],
      ["Sat 5", "1m", "short", 4, "− 1h 59m", "risk"],
      ["Sun 6", "—", "off", 0, "Off day", "neutral"],
    ]);
    expect(b.label).toContain("Mon 31 2h, ✓ Met; ");
    expect(b.label).toContain("Sun 6 0m, Off day");
  });

  it("has no target line when no day is planned", () => {
    const b = dayBars([day("2026-09-06", { logged_minutes: 0 })], {
      period_start: "2026-09-06",
      period_end: "2026-09-06",
    });
    expect(b.target).toBeNull();
  });

  it("rows a month by Monday-to-Sunday weeks, clipped to it", () => {
    const grid = [
      day("2026-09-01", {
        state: "target_met",
        logged_minutes: 120,
        target_minutes: 120,
      }),
      day("2026-09-02", {
        state: "worked_short",
        logged_minutes: 30,
        target_minutes: 120,
      }),
      day("2026-09-08", {
        state: "target_met",
        logged_minutes: 120,
        target_minutes: 120,
      }),
      day("2026-09-19", {
        state: "off_day_worked",
        logged_minutes: 60,
        target_minutes: 0,
      }),
    ];
    expect(
      monthWeeks(
        grid,
        { period_start: "2026-09-01", period_end: "2026-09-30" },
        TODAY,
      ),
    ).toEqual([
      {
        range: "Tue 1 – Sun 6 Sep",
        logged: "2h 30m",
        planned: "4h 00m",
        pct: 63,
        tone: "risk",
      },
      {
        range: "Mon 7 – Sun 13 Sep",
        logged: "2h 00m",
        planned: "2h 00m",
        pct: 100,
        tone: "ok",
      },
      {
        range: "Mon 14 – Sun 20 Sep",
        logged: "1h 00m",
        planned: "0h 00m",
        pct: 100,
        tone: "neutral",
      },
      {
        range: "Mon 21 – Sun 27 Sep",
        logged: "0h 00m",
        planned: "0h 00m",
        pct: 0,
        tone: "neutral",
      },
      {
        range: "Mon 28 – Wed 30 Sep",
        logged: "0h 00m",
        planned: "0h 00m",
        pct: 0,
        tone: "neutral",
      },
    ]);
  });

  it("lists the Chosen deviations to judge, counting the Drifted ones", () => {
    const r = review({
      deviations: [
        deviation({
          id: "late",
          local_date: "2026-09-04",
          verdict: "worth_it",
          verdict_review_id: "r2",
        }),
        deviation({ id: "early" }),
        deviation({ id: "drift", kind: "drifted", reasoning: undefined }),
        deviation({
          id: "judged",
          verdict: "not_worth_it",
          verdict_review_id: "rx",
        }),
        deviation({ id: "odd", reasoning: undefined, verdict_review_id: "rx" }),
      ],
    });
    const c = chosenCard(r, TODAY);
    expect(c.hint).toBe("4 Chosen · 1 Drifted this week");
    expect(c.none).toBe("No Chosen deviations this week.");
    expect(c.blocks.map((b) => [b.id, b.locked, b.verdict])).toEqual([
      ["early", null, null],
      ["judged", "not_worth_it", null],
      ["odd", null, null],
      ["late", null, "worth_it"],
    ]);
    expect(c.blocks[0]).toMatchObject({
      when: "Wed 2 Sep · 1h 30m",
      what: "Helped a friend move",
      reasoning: "Once a year.",
    });
    expect(c.blocks[2].reasoning).toBe("");
    expect(chosenCard(review({ kind: "monthly" }), TODAY).none).toBe(
      "No Chosen deviations this month.",
    );
  });
});

describe("the saved review", () => {
  const w1 = summary();
  const w2 = summary({
    id: "r2",
    label: "Week 2",
    period_start: "2026-08-31",
    period_end: "2026-09-06",
    saved_at: "2026-09-06T13:40:00Z",
  });
  const fin = summary({
    id: "rf",
    kind: "plan_end",
    label: "End of plan",
    period_start: "2026-09-07",
    period_end: "2026-09-13",
    saved_at: "2026-09-13T13:40:00Z",
  });

  it("links to neighbouring saved reviews", () => {
    expect(neighbours(w2, [w1, w2, fin], [])).toEqual({
      previous: { kind: "link", id: "r1", text: "Week 1" },
      next: { kind: "link", id: "rf", text: "Final review" },
    });
  });

  it("says why there is no neighbour", () => {
    expect(neighbours(w1, [w1], [])).toEqual({
      previous: { kind: "none", text: "No earlier review" },
      next: { kind: "none", text: "No later review" },
    });
    const draft = { ...w2, status: "draft" as const };
    expect(neighbours(w1, [w1, draft], []).next).toEqual({
      kind: "none",
      text: "Week 2 · still a draft",
    });
    expect(neighbours(w1, [w1], [due()]).next).toEqual({
      kind: "none",
      text: "Week 2 · not saved yet",
    });
    expect(
      neighbours(w1, [w1], [due({ kind: "plan_end", label: "End of plan" })])
        .next,
    ).toEqual({ kind: "none", text: "Final review · not saved yet" });
    // The earliest of a later draft and an unstarted due window.
    const week3 = summary({
      id: "r3",
      label: "Week 3",
      status: "draft",
      period_start: "2026-09-07",
      period_end: "2026-09-13",
    });
    expect(neighbours(w1, [w1, week3], [due()]).next).toEqual({
      kind: "none",
      text: "Week 2 · not saved yet",
    });
    // A due window that has a draft is told by the draft; an earlier one is ignored.
    expect(
      neighbours(
        w2,
        [w1, w2],
        [due({ review_id: "x" }), due({ period_start: "2026-08-01" })],
      ).next,
    ).toEqual({ kind: "none", text: "No later review" });
    // Not in the list at all: nothing either side.
    expect(
      neighbours({ id: "zz", period_end: "2026-09-30" }, [w1], []).previous,
    ).toEqual({ kind: "none", text: "No earlier review" });
  });

  it("says which review checked its change, or will", () => {
    expect(checkedIn(w1, [w1, w2], [])).toBe("Checked in the week 2 review");
    expect(checkedIn(w2, [w1, w2, fin], [])).toBe(
      "Checked in the final review",
    );
    // Week 2 saved before week 1: it could not have checked it.
    const early = { ...w2, saved_at: "2026-08-29T00:00:00Z" };
    expect(checkedIn(w1, [w1, early], [])).toBe("To check at the next review.");
    expect(checkedIn(w1, [w1], [due()])).toBe("To check in the week 2 review");
  });
});
