import { describe, expect, it } from "vitest";
import { validateObjectiveWrite } from "./validateObjectiveWrite";

const FIXED = {
  title: "Ship Keel",
  why_now: "The record only matters if it is kept from day one.",
  success_criteria: "Today renders real effort against a real plan.",
  schedule: {
    mode: "fixed",
    planned_weekdays: [1, 2, 3, 4, 5],
    minutes_per_planned_day: 120,
  },
  starts_on: "2026-11-02", // a Monday
  tz: "Asia/Kolkata",
  runs_for_days: 28,
  review_cadence: "weekly",
};

const FLEXIBLE = {
  ...FIXED,
  schedule: { mode: "flexible", days_per_week: 3, minutes_per_planned_day: 60 },
  review_cadence: "monthly",
};

function fields(input: unknown): string[] {
  const r = validateObjectiveWrite(input);
  if (r.ok || r.kind !== "invalid") throw new Error("expected invalid");
  return r.errors.map((e) => e.field).sort();
}

describe("validateObjectiveWrite — accepted", () => {
  it("normalises a fixed write and derives the end date inclusively", () => {
    const r = validateObjectiveWrite(FIXED);
    expect(r).toEqual({
      ok: true,
      value: {
        title: "Ship Keel",
        description: null,
        why_now: FIXED.why_now,
        success_criteria: FIXED.success_criteria,
        plan_link: null,
        review_cadence: "weekly",
        schedule: {
          mode: "fixed",
          planned_weekdays: [1, 2, 3, 4, 5],
          minutes_per_planned_day: 120,
        },
        starts_on: "2026-11-02",
        end_date: "2026-11-29",
      },
    });
  });

  it("normalises a flexible write", () => {
    const r = validateObjectiveWrite(FLEXIBLE);
    expect(r.ok && r.value.schedule).toEqual({
      mode: "flexible",
      days_per_week: 3,
      minutes_per_planned_day: 60,
    });
    expect(r.ok && r.value.review_cadence).toBe("monthly");
  });

  it("starts and ends a one-day objective on the same date", () => {
    const r = validateObjectiveWrite({ ...FIXED, runs_for_days: 1 });
    expect(r.ok && r.value.end_date).toBe("2026-11-02");
  });

  it("accepts 365 days, ending a year less a day later", () => {
    const r = validateObjectiveWrite({ ...FIXED, runs_for_days: 365 });
    expect(r.ok && r.value.end_date).toBe("2027-11-01");
  });

  it("sorts weekdays and drops repeats", () => {
    const r = validateObjectiveWrite({
      ...FIXED,
      schedule: { ...FIXED.schedule, planned_weekdays: [5, 1, 3, 1] },
    });
    expect(r.ok && r.value.schedule).toMatchObject({
      planned_weekdays: [1, 3, 5],
    });
  });

  it("keeps the optional text it is given, and a null link or parked idea", () => {
    const r = validateObjectiveWrite({
      ...FIXED,
      description: "Core Python, then data structures.",
      plan_link: "https://example.com/plan",
      from_parked_idea_id: null,
    });
    expect(r.ok && r.value.description).toBe(
      "Core Python, then data structures.",
    );
    expect(r.ok && r.value.plan_link).toBe("https://example.com/plan");
    const nullLink = validateObjectiveWrite({ ...FIXED, plan_link: null });
    expect(nullLink.ok && nullLink.value.plan_link).toBeNull();
  });
});

describe("validateObjectiveWrite — 400, a field wrong on its own", () => {
  it("names every missing required field on an empty body", () => {
    expect(fields({})).toEqual([
      "review_cadence",
      "runs_for_days",
      "schedule",
      "starts_on",
      "success_criteria",
      "title",
      "tz",
      "why_now",
    ]);
  });

  it("treats a body that is not an object as empty", () => {
    for (const body of [null, "text", 42, [FIXED]]) {
      expect(fields(body)).toContain("title");
    }
  });

  it("refuses text out of its length range", () => {
    expect(
      fields({
        ...FIXED,
        title: "x".repeat(201),
        description: "x".repeat(4001),
        why_now: "",
        success_criteria: "x".repeat(2001),
      }),
    ).toEqual(["description", "success_criteria", "title", "why_now"]);
  });

  it("refuses a link that is not a URI", () => {
    expect(fields({ ...FIXED, plan_link: "not a link" })).toEqual([
      "plan_link",
    ]);
    expect(fields({ ...FIXED, plan_link: 42 })).toEqual(["plan_link"]);
  });

  it("refuses a malformed or impossible start date", () => {
    expect(fields({ ...FIXED, starts_on: "02-11-2026" })).toEqual([
      "starts_on",
    ]);
    expect(fields({ ...FIXED, starts_on: "2026-02-30" })).toEqual([
      "starts_on",
    ]);
  });

  it("refuses a zone the runtime does not know, and validates rather than stores it", () => {
    expect(fields({ ...FIXED, tz: "Mars/Olympus" })).toEqual(["tz"]);
    const r = validateObjectiveWrite(FIXED);
    expect(r.ok && "tz" in r.value).toBe(false);
  });

  it("refuses runs_for_days outside 1–365 or not an integer", () => {
    for (const days of [0, 366, 1.5, "28"]) {
      expect(fields({ ...FIXED, runs_for_days: days })).toEqual([
        "runs_for_days",
      ]);
    }
  });

  it("refuses a cadence that is neither weekly nor monthly", () => {
    expect(fields({ ...FIXED, review_cadence: "daily" })).toEqual([
      "review_cadence",
    ]);
  });

  it("refuses a parked idea, which cannot be checked yet", () => {
    expect(
      fields({
        ...FIXED,
        from_parked_idea_id: "00000000-0000-0000-0000-0000000000aa",
      }),
    ).toEqual(["from_parked_idea_id"]);
  });

  it("refuses a schedule that is not an object, or has no mode", () => {
    expect(fields({ ...FIXED, schedule: "fixed" })).toEqual(["schedule"]);
    expect(
      fields({ ...FIXED, schedule: { minutes_per_planned_day: 60 } }),
    ).toEqual(["schedule.mode"]);
  });

  it("refuses minutes outside 15–1440", () => {
    for (const minutes of [14, 1441, undefined]) {
      expect(
        fields({
          ...FIXED,
          schedule: { ...FIXED.schedule, minutes_per_planned_day: minutes },
        }),
      ).toEqual(["schedule.minutes_per_planned_day"]);
    }
  });

  it("refuses a fixed schedule with no weekdays, or one out of range", () => {
    for (const days of [[], [0], [8], [1, "2"], undefined, "Mon"]) {
      expect(
        fields({
          ...FIXED,
          schedule: { ...FIXED.schedule, planned_weekdays: days },
        }),
      ).toEqual(["schedule.planned_weekdays"]);
    }
  });

  it("refuses a flexible day count outside 1–7", () => {
    for (const count of [0, 8, undefined]) {
      expect(
        fields({
          ...FLEXIBLE,
          schedule: { ...FLEXIBLE.schedule, days_per_week: count },
        }),
      ).toEqual(["schedule.days_per_week"]);
    }
  });

  it("refuses a fixed run that falls on none of its weekdays", () => {
    // Saturday 7th and Sunday 8th, planning Mondays only: no real target.
    const r = validateObjectiveWrite({
      ...FIXED,
      starts_on: "2026-11-07",
      runs_for_days: 2,
      schedule: { ...FIXED.schedule, planned_weekdays: [1] },
    });
    expect(r).toEqual({
      ok: false,
      kind: "invalid",
      errors: [
        {
          field: "schedule.planned_weekdays",
          message: "None of these weekdays falls inside the run.",
        },
      ],
    });
  });
});

describe("validateObjectiveWrite — 422, a schedule that contradicts its mode", () => {
  it("refuses a day count on a fixed schedule", () => {
    const r = validateObjectiveWrite({
      ...FIXED,
      schedule: { ...FIXED.schedule, days_per_week: 3 },
    });
    expect(r).toEqual({
      ok: false,
      kind: "mode_mismatch",
      detail: "A fixed schedule takes planned_weekdays, not days_per_week.",
    });
  });

  it("refuses weekdays on a flexible schedule", () => {
    const r = validateObjectiveWrite({
      ...FLEXIBLE,
      schedule: { ...FLEXIBLE.schedule, planned_weekdays: [1, 3] },
    });
    expect(r).toEqual({
      ok: false,
      kind: "mode_mismatch",
      detail: "A flexible schedule takes days_per_week, not planned_weekdays.",
    });
  });

  it("reports a field error first when a mismatched schedule is also invalid", () => {
    // Fixed, with a day count and no weekdays: the missing field is the 400.
    expect(
      fields({
        ...FIXED,
        schedule: {
          mode: "fixed",
          days_per_week: 3,
          minutes_per_planned_day: 60,
        },
      }),
    ).toEqual(["schedule.planned_weekdays"]);
  });
});
