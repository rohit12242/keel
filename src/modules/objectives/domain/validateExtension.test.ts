import { describe, expect, it } from "vitest";
import type { ObjectiveRow, ObjectiveSegmentRow } from "./rows";
import {
  extensionDecision,
  extensionSpan,
  validateExtensionWrite,
  type ExtensionWrite,
} from "./validateExtension";
import { FIXED_ONLY } from "./validateObjectiveWrite";

const RID = "0b6f3c1e-7d1a-4c55-9a51-6f0c2a8e9b11";

const body = (over: Record<string, unknown> = {}) => ({
  review_id: RID,
  extend_by_days: 14,
  reason: "Close, but not done.",
  schedule: {
    mode: "fixed",
    planned_weekdays: [3, 1, 1],
    minutes_per_planned_day: 60,
  },
  review_cadence: "monthly",
  ...over,
});

describe("validateExtensionWrite", () => {
  it("accepts an extension, its schedule normalised", () => {
    expect(validateExtensionWrite(body())).toEqual({
      ok: true,
      value: {
        review_id: RID,
        extend_by_days: 14,
        reason: "Close, but not done.",
        schedule: {
          mode: "fixed",
          planned_weekdays: [1, 3],
          minutes_per_planned_day: 60,
        },
        review_cadence: "monthly",
      },
    });
  });

  it("requires the extension's own review cadence (I-14)", () => {
    for (const review_cadence of [undefined, "daily"]) {
      const r = validateExtensionWrite(body({ review_cadence }));
      expect(r.ok ? [] : r.error.map((e) => e.field)).toEqual([
        "review_cadence",
      ]);
    }
  });

  it("names every bad field, and a schedule that contradicts its mode", () => {
    const r = validateExtensionWrite({
      review_id: "x",
      extend_by_days: 0,
      reason: "",
      schedule: { mode: "flexible", minutes_per_planned_day: 60 },
    });
    expect(r.ok ? [] : r.error.map((e) => e.field)).toEqual([
      "review_id",
      "extend_by_days",
      "reason",
      "review_cadence",
      "schedule.days_per_week",
    ]);
    const mismatch = validateExtensionWrite(
      body({
        schedule: {
          mode: "flexible",
          days_per_week: 3,
          planned_weekdays: [1],
          minutes_per_planned_day: 60,
        },
      }),
    );
    expect(mismatch.ok ? [] : mismatch.error.map((e) => e.field)).toEqual([
      "schedule",
    ]);
    expect(validateExtensionWrite(null).ok).toBe(false);
  });

  it("parses a flexible schedule, which extensionDecision then refuses (I-09)", () => {
    expect(
      validateExtensionWrite(
        body({
          schedule: {
            mode: "flexible",
            days_per_week: 3,
            minutes_per_planned_day: 60,
          },
        }),
      ),
    ).toMatchObject({
      ok: true,
      value: {
        schedule: {
          mode: "flexible",
          days_per_week: 3,
          minutes_per_planned_day: 60,
        },
      },
    });
  });

  it("an extension stays at 365 days, though a new objective may run 366 (G42)", () => {
    expect(validateExtensionWrite(body({ extend_by_days: 365 })).ok).toBe(true);
    const r = validateExtensionWrite(body({ extend_by_days: 366 }));
    expect(r.ok ? [] : r.error.map((e) => e.field)).toEqual(["extend_by_days"]);
  });
});

const segment = (
  over: Partial<ObjectiveSegmentRow> = {},
): ObjectiveSegmentRow => ({
  id: "s0",
  seq: 0,
  schedule_mode: "fixed",
  planned_weekdays: 31,
  days_per_week: null,
  minutes_per_planned_day: 60,
  start_date: "2026-09-14",
  end_date: "2026-10-11",
  plans_from: "2026-09-14",
  review_cadence: "weekly",
  reason: "r",
  created_by_review_id: null,
  ...over,
});
const planEnd = (
  over: Partial<ObjectiveRow["saved_reviews"][number]> = {},
) => ({
  id: RID,
  outcome: "continued" as const,
  period_start: "2026-10-05",
  period_end: "2026-10-11",
  kind: "plan_end" as const,
  criteria_verdict: "partly_met" as const,
  ...over,
});
const row = (over: Partial<ObjectiveRow> = {}): ObjectiveRow => ({
  id: "o",
  title: "t",
  description: null,
  why_now: "w",
  success_criteria: "c",
  plan_link: null,
  review_cadence: "weekly",
  from_parked_idea_id: null,
  segments: [segment()],
  status_events: [
    { occurred_on: "2026-09-14", change: "created", reason: null },
  ],
  daily_minutes: [],
  saved_reviews: [planEnd()],
  notes: [],
  ...over,
});
const write = (over: Partial<ExtensionWrite> = {}): ExtensionWrite => ({
  review_id: RID,
  extend_by_days: 14,
  reason: "Close, but not done.",
  schedule: {
    mode: "fixed",
    planned_weekdays: [1, 3],
    minutes_per_planned_day: 60,
  },
  review_cadence: "monthly",
  ...over,
});

describe("extensionDecision", () => {
  it("refuses a flexible schedule: v1 plans fixed objectives only (I-09)", () => {
    expect(
      extensionDecision(
        row(),
        write({
          schedule: {
            mode: "flexible",
            days_per_week: 3,
            minutes_per_planned_day: 60,
          },
        }),
        "2026-10-13",
      ),
    ).toEqual({
      ok: false,
      error: { kind: "fixed_only", detail: FIXED_ONLY },
    });
  });

  it("adds the next segment, starting and planning the day after the plan ends, made on time", () => {
    expect(extensionDecision(row(), write(), "2026-10-12")).toEqual({
      ok: true,
      value: {
        seq: 1,
        start_date: "2026-10-12",
        end_date: "2026-10-25",
        plans_from: "2026-10-12",
        review_cadence: "monthly",
        schedule: {
          mode: "fixed",
          planned_weekdays: [1, 3],
          minutes_per_planned_day: 60,
        },
        reason: "Close, but not done.",
        created_by_review_id: RID,
      },
    });
  });

  it("plans a late extension from today, and counts its days from there (G48)", () => {
    expect(extensionDecision(row(), write(), "2026-10-16")).toMatchObject({
      ok: true,
      value: {
        start_date: "2026-10-12",
        plans_from: "2026-10-16",
        end_date: "2026-10-29",
      },
    });
  });

  it("checks the weekdays over the days it plans, not the gap before", () => {
    // Fri 16 – Sat 17 October: no Monday, though Mon 12 lies in the gap.
    expect(
      extensionDecision(
        row(),
        write({
          extend_by_days: 2,
          schedule: {
            mode: "fixed",
            planned_weekdays: [1],
            minutes_per_planned_day: 60,
          },
        }),
        "2026-10-16",
      ),
    ).toMatchObject({ ok: false, error: { kind: "invalid" } });
  });

  it("409s without a saved plan-end review of the plan as it stands", () => {
    expect(
      extensionDecision(row({ saved_reviews: [] }), write(), "2026-10-13"),
    ).toMatchObject({
      ok: false,
      error: {
        kind: "conflict",
        detail: expect.stringMatching(/No saved plan-end review/),
      },
    });
    expect(
      extensionDecision(
        row({ saved_reviews: [planEnd({ kind: "weekly" })] }),
        write(),
        "2026-10-13",
      ),
    ).toMatchObject({ ok: false, error: { kind: "conflict" } });
  });

  it("409s a review that already extended the plan", () => {
    const extended = row({
      segments: [
        segment(),
        segment({
          id: "s1",
          seq: 1,
          start_date: "2026-10-12",
          end_date: "2026-10-25",
          plans_from: "2026-10-12",
          review_cadence: "weekly",
          created_by_review_id: RID,
        }),
      ],
    });
    expect(extensionDecision(extended, write(), "2026-10-30")).toMatchObject({
      ok: false,
      error: {
        kind: "conflict",
        detail: expect.stringMatching(/already extended/),
      },
    });
  });

  it("409s an outcome other than continued", () => {
    expect(
      extensionDecision(
        row({ saved_reviews: [planEnd({ outcome: "completed" })] }),
        write(),
        "2026-10-13",
      ),
    ).toMatchObject({
      ok: false,
      error: {
        kind: "conflict",
        detail: expect.stringMatching(/only continued/),
      },
    });
  });

  it("409s until the plan's end date has passed", () => {
    expect(extensionDecision(row(), write(), "2026-10-11")).toMatchObject({
      ok: false,
      error: { kind: "conflict", detail: expect.stringMatching(/has passed/) },
    });
  });

  it("422s an extension that would not end after today — refused, not adjusted", () => {
    expect(
      extensionDecision(row(), write({ extend_by_days: 1 }), "2026-10-13"),
    ).toMatchObject({
      ok: false,
      error: { kind: "not_in_future" },
    });
  });

  it("refuses a fixed extension that plans none of its days", () => {
    expect(
      extensionDecision(
        row(),
        write({
          extend_by_days: 2, // Mon 12 and Tue 13 October
          schedule: {
            mode: "fixed",
            planned_weekdays: [6],
            minutes_per_planned_day: 60,
          },
        }),
        "2026-10-12",
      ),
    ).toMatchObject({ ok: false, error: { kind: "invalid" } });
  });
});

describe("extensionSpan", () => {
  it("starts the day after the old end, and plans from then when made on time", () => {
    expect(extensionSpan("2026-09-04", "2026-09-05", 21)).toEqual({
      start_date: "2026-09-05",
      plans_from: "2026-09-05",
      end_date: "2026-09-25",
    });
  });

  it("plans from today when made late, and ends its days after that", () => {
    expect(extensionSpan("2026-09-04", "2026-09-14", 21)).toEqual({
      start_date: "2026-09-05",
      plans_from: "2026-09-14",
      end_date: "2026-10-04",
    });
  });

  it("never plans before its start, whatever today says", () => {
    expect(extensionSpan("2026-09-04", "2026-09-01", 1).plans_from).toBe(
      "2026-09-05",
    );
  });
});
