import { describe, expect, it } from "vitest";
import { reviewWindows } from "@/modules/reviews/domain/reviewWindows";
import { generateSlots } from "./generateSlots";
import {
  checkDraft,
  createdMessage,
  dayLabel,
  DEFAULT_DRAFT,
  duration,
  preview,
  runsForDays,
  startChoices,
  type Draft,
} from "./newObjective";
import { validateObjectiveWrite } from "./validateObjectiveWrite";

// The design's today: Sat 5 Sep 2026.
const TODAY = "2026-09-05";
const TZ = "Asia/Kolkata";

const FILLED: Draft = {
  ...DEFAULT_DRAFT,
  name: "Conversational English",
  why: "Speak up at work without rehearsing.",
  criteria: "Hold a 15-minute conversation.",
};

const draft = (over: Partial<Draft> = {}): Draft => ({ ...FILLED, ...over });

function errorsOf(d: Draft) {
  const r = checkDraft(d, TODAY, TZ);
  if (r.ok) throw new Error("expected errors");
  return r;
}

const targetError = (over: Partial<Draft>) =>
  checkDraft(draft(over), TODAY, TZ).ok
    ? null
    : errorsOf(draft(over)).errors.target;

describe("dayLabel and duration", () => {
  it("reads as the design writes dates, with the year only when it differs", () => {
    expect(dayLabel("2026-09-06", TODAY)).toBe("Sun 6 Sep");
    expect(dayLabel("2027-01-05", TODAY)).toBe("Tue 5 Jan 2027");
  });

  it("writes minutes as 45m, and hours with two-digit minutes", () => {
    expect(duration(45)).toBe("45m");
    expect(duration(60)).toBe("1h 00m");
    expect(duration(126)).toBe("2h 06m");
  });
});

describe("startChoices", () => {
  it("today, tomorrow and next Monday, from a Saturday", () => {
    expect(startChoices(TODAY)).toEqual({
      today: "2026-09-05",
      tomorrow: "2026-09-06",
      monday: "2026-09-07",
    });
  });

  it("on a Monday, next Monday is the Monday after; on a Sunday, tomorrow", () => {
    expect(startChoices("2026-09-07").monday).toBe("2026-09-14");
    expect(startChoices("2026-09-06").monday).toBe("2026-09-07");
  });

  it("crosses the year on 31 December", () => {
    expect(startChoices("2026-12-31")).toEqual({
      today: "2026-12-31",
      tomorrow: "2027-01-01",
      monday: "2027-01-04",
    });
  });
});

describe("runsForDays", () => {
  it("weeks are seven days each", () => {
    expect(runsForDays(TODAY, 4, "weeks")).toBe(28);
    expect(runsForDays(TODAY, 52, "weeks")).toBe(364);
  });

  it("months end the day before the same date, clamped at month end", () => {
    // From Sat 5 Sep, 1 month ends Sun 4 Oct: 30 days.
    expect(runsForDays("2026-09-05", 1, "months")).toBe(30);
    // From 31 Jan, 1 month ends 27 Feb, or 28 Feb in a leap year.
    expect(runsForDays("2027-01-31", 1, "months")).toBe(28);
    expect(runsForDays("2028-01-31", 1, "months")).toBe(29);
  });

  it("twelve months across a 29 February is 366 days (G42)", () => {
    expect(runsForDays("2027-03-01", 12, "months")).toBe(366);
  });
});

describe("preview", () => {
  it("the prototype's defaults: tomorrow, 4 weeks, Mon–Fri at 1h", () => {
    expect(preview(FILLED, TODAY)).toEqual({
      startsOn: "2026-09-06",
      endsOn: "2026-10-03",
      endLabel: "ends Sat 3 Oct",
      reviewHint:
        "A review is due at the end of each week. The last one, on Sat 3 Oct, looks at the whole plan.",
      plannedDays: 20,
      eachWeek: "5h 00m",
      reviews: 4,
    });
  });

  it("reads — with no target, and runs a week while the length is empty", () => {
    const p = preview(draft({ hours: "", minutes: "", length: "" }), TODAY);
    expect(p.eachWeek).toBe("—");
    expect(p.endsOn).toBe("2026-09-12");
  });

  it("monthly reviews, into the next year with the year shown", () => {
    const p = preview(
      draft({
        start: "today",
        length: "5",
        unit: "months",
        cadence: "monthly",
      }),
      TODAY,
    );
    expect(p.endLabel).toBe("ends Thu 4 Feb 2027");
    expect(p.reviewHint).toMatch(/^A review is due at the end of each month\./);
    expect(p.reviews).toBe(5);
  });

  it("reviews follow the calendar week: from a Thursday, 4 weeks is 4 reviews", () => {
    // Thu 10 Sep … Wed 7 Oct: a 4-day first week, and a 3-day tail joined.
    const p = preview(draft({ start: "tomorrow" }), "2026-09-09");
    expect([p.startsOn, p.endsOn, p.reviews]).toEqual([
      "2026-09-10",
      "2026-10-07",
      4,
    ]);
  });

  it("counts planned days and reviews with the server's own rules", () => {
    for (const d of [
      draft({ weekdays: [1, 3], length: "9", cadence: "monthly" }),
      draft({ weekdays: [6, 7], start: "monday", length: "2", unit: "months" }),
    ]) {
      const p = preview(d, TODAY);
      const span = { start_date: p.startsOn, end_date: p.endsOn };
      expect(p.plannedDays).toBe(
        generateSlots({
          scheduleMode: "fixed",
          plannedWeekdays: d.weekdays,
          minutesPerPlannedDay: 60,
          startDate: span.start_date,
          endDate: span.end_date,
        }).length,
      );
      expect(p.reviews).toBe(
        reviewWindows(d.cadence, { id: "x", ...span }).length,
      );
    }
  });
});

describe("checkDraft — the design's messages", () => {
  it("an empty form names every field in page order, focus on Name", () => {
    const r = errorsOf({
      ...DEFAULT_DRAFT,
      weekdays: [],
      hours: "",
      minutes: "",
      length: "",
    });
    expect(r.first).toBe("name");
    expect(r.errors).toEqual({
      name: "Name the objective.",
      why: "Say why it matters. You'll read it again at review.",
      criteria: "Say what would prove it worked.",
      days: "Pick at least one day.",
      target: "Set a target above zero.",
      length: "Enter how long it runs.",
    });
  });

  it("text of spaces alone is empty", () => {
    expect(errorsOf(draft({ why: "   " })).errors).toEqual({
      why: "Say why it matters. You'll read it again at review.",
    });
  });

  it("minutes go up to 59", () => {
    expect(targetError({ hours: "1", minutes: "59" })).toBeNull();
    expect(targetError({ hours: "1", minutes: "60" })).toBe(
      "Minutes go up to 59.",
    );
  });

  it("a fixed day is 15 minutes to 16 hours (G41)", () => {
    expect(targetError({ hours: "0", minutes: "14" })).toBe(
      "Set at least 15 minutes a day.",
    );
    expect(targetError({ hours: "0", minutes: "15" })).toBeNull();
    expect(targetError({ hours: "16", minutes: "00" })).toBeNull();
    expect(targetError({ hours: "16", minutes: "01" })).toBe(
      "Keep a daily target under 16 hours.",
    );
  });

  it("anything but digits reads as nothing typed", () => {
    expect(targetError({ hours: "x", minutes: "" })).toBe(
      "Set a target above zero.",
    );
  });

  it("keeps it to a year or less: 52 weeks, 12 months", () => {
    const len = (length: string, unit: Draft["unit"]) =>
      checkDraft(draft({ length, unit }), TODAY, TZ).ok
        ? null
        : errorsOf(draft({ length, unit })).errors.length;
    expect(len("52", "weeks")).toBeNull();
    expect(len("53", "weeks")).toBe("Keep it to a year or less.");
    expect(len("12", "months")).toBeNull();
    expect(len("13", "months")).toBe("Keep it to a year or less.");
    expect(len("0", "weeks")).toBe("Enter how long it runs.");
  });
});

describe("checkDraft — the body", () => {
  it("trims the text and sends the browser's day and zone", () => {
    const r = checkDraft(
      draft({ name: "  Ship  ", weekdays: [5, 1, 3], start: "today" }),
      TODAY,
      TZ,
    );
    expect(r).toEqual({
      ok: true,
      body: {
        title: "Ship",
        why_now: FILLED.why,
        success_criteria: FILLED.criteria,
        schedule: {
          mode: "fixed",
          planned_weekdays: [1, 3, 5],
          minutes_per_planned_day: 60,
        },
        starts_on: TODAY,
        tz: TZ,
        runs_for_days: 28,
        review_cadence: "weekly",
      },
    });
  });
});

describe("whatever passes the page, the API accepts", () => {
  const targets: [string, string][] = [
    ["0", "15"],
    ["1", "00"],
    ["2", "05"],
    ["16", "00"],
    ["99", "59"],
  ];
  const lengths: [string, Draft["unit"]][] = [
    ["1", "weeks"],
    ["52", "weeks"],
    ["1", "months"],
    ["12", "months"],
  ];
  // Starts across 29 February, a year end, and a month end.
  const todays = ["2027-03-01", "2028-02-27", "2026-12-31", "2027-01-31"];

  it("a grid of drafts: every one that passes gives a body validateObjectiveWrite takes, ending where the preview says", () => {
    let passed = 0;
    for (const today of todays)
      for (const start of ["today", "tomorrow", "monday"] as const)
        for (const [length, unit] of lengths)
          for (const cadence of ["weekly", "monthly"] as const)
            for (const [hours, minutes] of targets)
              for (const weekdays of [[1], [6, 7], [1, 2, 3, 4, 5, 6, 7]]) {
                const d = draft({
                  weekdays,
                  start,
                  length,
                  unit,
                  cadence,
                  hours,
                  minutes,
                });
                const checked = checkDraft(d, today, TZ);
                if (!checked.ok) continue;
                passed++;
                const accepted = validateObjectiveWrite(checked.body);
                if (!accepted.ok) {
                  throw new Error(
                    `refused: ${JSON.stringify(checked.body)} → ${JSON.stringify(accepted)}`,
                  );
                }
                expect(accepted.value.end_date).toBe(preview(d, today).endsOn);
              }
    expect(passed).toBeGreaterThan(1000);
  });
});

describe("createdMessage", () => {
  it("says today, or the day it starts", () => {
    expect(createdMessage(TODAY, TODAY)).toBe(
      "Objective created. It starts today.",
    );
    expect(createdMessage("2026-09-06", TODAY)).toBe(
      "Objective created. It starts Sun 6 Sep.",
    );
  });
});
