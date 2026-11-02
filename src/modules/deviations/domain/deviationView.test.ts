import { describe, expect, it } from "vitest";
import type { Deviation, DeviationPattern, PlanWeek } from "@/shared/contract";
import {
  byWeek,
  countWord,
  detail,
  deviationTile,
  deviationWeek,
  emptyFilter,
  filters,
  inFilter,
  lastCard,
  mostRecent,
  ordinal,
  pulledFrom,
  row,
  tabSummary,
  thisWeek,
  weekBox,
} from "./deviationView";

/** Sat 5 Sep 2026; its week is Mon 31 Aug – Sun 6 Sep. */
const TODAY = "2026-09-05";

function deviation(d: Partial<Deviation> = {}): Deviation {
  return {
    id: "d1",
    objective_ids: ["o1"],
    local_date: "2026-09-02",
    tz: "Europe/London",
    kind: "chosen",
    what_happened: "Took two days off for an interview.",
    reasoning: "A real interview beats practising for one.",
    minutes: 300,
    pattern_id: null,
    pattern_name: null,
    verdict: null,
    verdict_review_id: null,
    pattern_nth: null,
    review_due_on: "2026-09-21",
    ...d,
  };
}

const drifted = deviation({
  id: "d2",
  kind: "drifted",
  reasoning: undefined,
  what_happened: "An evening of reading about hashing.",
  local_date: "2026-09-04",
  minutes: 45,
  pattern_id: "p1",
  pattern_name: "Research spiral",
  pattern_nth: 3,
});

const names = new Map([
  ["o1", "Python and DSA"],
  ["o2", "Writing"],
]);

const patterns: DeviationPattern[] = [
  {
    id: "p1",
    name: "Research spiral",
    description: "One question turns into a day of reading.",
    occurrences: 3,
  },
];

const cost = {
  chosen: { count: 1, minutes: 300 },
  drifted: { count: 1, minutes: 45 },
};
const none = {
  chosen: { count: 0, minutes: 0 },
  drifted: { count: 0, minutes: 0 },
};

describe("words", () => {
  it("counts deviations", () => {
    expect(countWord(1)).toBe("1 deviation");
    expect(countWord(2)).toBe("2 deviations");
  });

  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 111].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "111th",
    ]);
  });
});

describe("thisWeek", () => {
  it("runs Monday to Sunday around today", () => {
    expect(thisWeek(TODAY)).toEqual({
      from: "2026-08-31",
      to: "2026-09-06",
      range: "31 Aug – 6 Sep",
    });
  });

  it("starts on today when today is a Monday, and ends on it on a Sunday", () => {
    expect(thisWeek("2026-08-31").from).toBe("2026-08-31");
    expect(thisWeek("2026-09-06").from).toBe("2026-08-31");
    expect(thisWeek("2026-09-06").to).toBe("2026-09-06");
  });
});

describe("the page", () => {
  it("counts the filters from the API's cost", () => {
    expect(filters(cost)).toEqual([
      { id: "all", label: "All", count: 2 },
      { id: "chosen", label: "Chosen", count: 1 },
      { id: "drifted", label: "Drifted", count: 1 },
    ]);
    expect(filters(none).map((f) => f.count)).toEqual([0, 0, 0]);
  });

  it("keeps the API's order in a filter", () => {
    const list = [drifted, deviation()];
    expect(inFilter(list, "all")).toEqual(list);
    expect(inFilter(list, "chosen")).toEqual([list[1]]);
    expect(inFilter(list, "drifted")).toEqual([drifted]);
    expect(emptyFilter("drifted")).toBe("Nothing drifted this week.");
  });

  it("totals the week from the cost alone", () => {
    expect(weekBox(cost)).toEqual({
      all: "5h 45m",
      chosen: "5h 00m",
      drifted: "0h 45m",
    });
    expect(weekBox(none).all).toBe("0h 00m");
  });

  it("names every objective a deviation pulled from", () => {
    expect(pulledFrom(deviation({ objective_ids: ["o1", "o2"] }), names)).toBe(
      "Python and DSA, Writing",
    );
    expect(pulledFrom(deviation({ objective_ids: ["o9"] }), names)).toBe("");
  });

  it("writes a row", () => {
    expect(row(deviation(), names, TODAY)).toEqual({
      id: "d1",
      kind: "chosen",
      meta: "Wed 2 Sep · Python and DSA",
      text: "Took two days off for an interview.",
      duration: "5h 00m",
    });
    expect(row(drifted, names, TODAY).duration).toBe("45m");
  });
});

describe("detail", () => {
  it("shows a chosen deviation's reasoning and the review that will test it", () => {
    expect(detail(deviation(), names, patterns, TODAY)).toEqual({
      kind: "chosen",
      title: "Took two days off for an interview.",
      tiles: [
        { label: "Time off plan", value: "5h 00m" },
        { label: "Pulled from", value: "Python and DSA" },
        { label: "When", value: "Wed 2 Sep" },
      ],
      reasoning: "A real interview beats practising for one.",
      pattern: null,
      didInstead: null,
      verdict:
        "Not reviewed yet. At the 21 Sep review you'll mark whether the reasoning held.",
    });
  });

  it("reads a chosen deviation with no reasoning as none", () => {
    expect(
      detail(deviation({ reasoning: undefined }), names, [], TODAY).reasoning,
    ).toBeNull();
  });

  it("shows a drifted deviation's pattern, its place and its description", () => {
    const d = detail(
      { ...drifted, did_instead: "Read papers." },
      names,
      patterns,
      TODAY,
    );
    expect(d.reasoning).toBeNull();
    expect(d.pattern).toEqual({
      name: "Research spiral",
      nth: "3rd time",
      description: "One question turns into a day of reading.",
    });
    expect(d.didInstead).toBe("Read papers.");
    expect(d.verdict).toBe(
      "Not reviewed yet. It counts toward the pattern at the 21 Sep review.",
    );
  });

  it("falls back to the pattern list's name, and to nothing", () => {
    const d = { ...drifted, pattern_name: null, pattern_nth: null };
    expect(detail(d, names, patterns, TODAY).pattern).toEqual({
      name: "Research spiral",
      nth: null,
      description: "One question turns into a day of reading.",
    });
    expect(detail(d, names, [], TODAY).pattern).toEqual({
      name: "",
      nth: null,
      description: null,
    });
  });

  it("reads None of these as a one-off", () => {
    const d = { ...drifted, pattern_id: null, pattern_name: null };
    expect(detail(d, names, patterns, TODAY).pattern).toEqual({
      name: "A one-off · no pattern",
      nth: null,
      description: null,
    });
    expect(detail(d, names, patterns, TODAY).verdict).toBe(
      "Not reviewed yet. It comes up at the 21 Sep review.",
    );
  });

  it("shows the verdict once a review has given one", () => {
    const at = (verdict: Deviation["verdict"]) =>
      detail(deviation({ verdict }), names, [], TODAY).verdict;
    expect(at("worth_it")).toBe("Worth it, at review.");
    expect(at("not_worth_it")).toBe("Not worth it, at review.");
  });

  it("says only 'Not reviewed yet.' when no review covers it", () => {
    expect(
      detail(deviation({ review_due_on: null }), names, [], TODAY).verdict,
    ).toBe("Not reviewed yet.");
  });
});

describe("Today's card", () => {
  it("writes the line, and opens one from this week", () => {
    expect(lastCard(drifted, TODAY)).toEqual({
      id: "d2",
      kind: "drifted",
      text: "An evening of reading about hashing.",
      line: "4 Sep · 45m · Research spiral",
      openable: true,
    });
  });

  it("leaves out a missing pattern, and doesn't open one from last week", () => {
    const c = lastCard(deviation({ local_date: "2026-08-30" }), TODAY);
    expect(c.line).toBe("30 Aug · 5h 00m");
    expect(c.openable).toBe(false);
  });
});

describe("an objective's tab", () => {
  const weeks: PlanWeek[] = [
    { period_start: "2026-08-24", period_end: "2026-08-30" },
    { period_start: "2026-08-31", period_end: "2026-09-06" },
    { period_start: "2026-09-07", period_end: "2026-09-13" },
  ].map((w) => ({
    ...w,
    figures: { adherence_pct: 0, logged_minutes: 0, target_minutes: 0 },
  }));
  const early = deviation({ id: "d0", local_date: "2026-08-25", minutes: 60 });
  const list = [drifted, deviation(), early];

  it("sums the cost, or says there are none", () => {
    expect(tabSummary(cost)).toEqual({
      count: "2 deviations",
      all: "5h 45m",
      chosen: "5h 00m",
      drifted: "0h 45m",
    });
    expect(tabSummary(none)).toBeNull();
  });

  it("shows the most recent, openable when it's this week", () => {
    expect(mostRecent(list, TODAY)).toEqual({
      id: "d2",
      kind: "drifted",
      text: "An evening of reading about hashing.",
      line: "45m · Research spiral",
      reasoning: null,
      date: "Fri 4 Sep",
      openable: true,
    });
    const old = mostRecent([early], TODAY);
    expect(old?.reasoning).toBe("A real interview beats practising for one.");
    expect(old?.openable).toBe(false);
    expect(mostRecent([], TODAY)).toBeNull();
    expect(
      mostRecent([deviation({ reasoning: undefined })], TODAY)?.reasoning,
    ).toBeNull();
  });

  it("counts by plan week, the weeks that have begun", () => {
    const rows = byWeek(weeks, list, TODAY);
    expect(
      rows.map((r) => [r.label, r.soFar, r.count, r.chosen, r.drifted]),
    ).toEqual([
      ["Week 1 · Mon 24 Aug – Sun 30 Aug", false, 1, "1h 00m", "—"],
      ["Week 2 · Mon 31 Aug – Sun 6 Sep", true, 2, "5h 00m", "45m"],
    ]);
  });

  it("opens a week to its days up to today", () => {
    const [, second] = byWeek(weeks, list, TODAY);
    const w = deviationWeek(second, list, TODAY);
    expect(w.title).toBe("Deviations · Week 2");
    expect(w.sub).toBe(
      "Mon 31 Aug – Sun 6 Sep · 2 deviations · 5h 45m off plan",
    );
    expect(w.days.map((d) => d.date)).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
    expect(w.days[0]).toEqual({
      date: "2026-08-31",
      chip: "Mon 31",
      title: "Mon 31 Aug",
      items: [],
      empty: "No deviations.",
    });
    expect(w.days[2].items).toEqual([
      {
        id: "d1",
        kind: "chosen",
        text: "Took two days off for an interview.",
        line: "5h 00m",
        reasoning: "A real interview beats practising for one.",
      },
    ]);
    expect(w.days[2].empty).toBeNull();
  });

  it("lists a whole past week", () => {
    const [first] = byWeek(weeks, list, TODAY);
    const w = deviationWeek(first, list, TODAY);
    expect(w.days).toHaveLength(7);
    expect(w.sub).toBe(
      "Mon 24 Aug – Sun 30 Aug · 1 deviation · 1h 00m off plan",
    );
  });

  it("gives So far its Deviation time", () => {
    expect(deviationTile(cost)).toEqual({
      label: "Deviation time",
      value: "5h 45m",
      hint: "2 deviations",
    });
    expect(deviationTile(none)).toEqual({
      label: "Deviation time",
      value: "0h 00m",
      hint: "No deviations",
    });
  });
});
