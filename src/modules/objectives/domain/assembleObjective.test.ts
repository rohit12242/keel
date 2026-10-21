import { describe, expect, it } from "vitest";
import {
  assembleList,
  assembleObjective,
  assembleSummary,
  parseStatusFilter,
} from "./assembleObjective";
import type { ObjectiveRow, ObjectiveSegmentRow } from "./rows";

/**
 * The objectives read, assembled from facts only (ADR-008). Status from the
 * events, dates from the segments, figures from the planned slots.
 */
const SEG_0: ObjectiveSegmentRow = {
  id: "seg-0",
  seq: 0,
  schedule_mode: "fixed",
  planned_weekdays: 0b11111, // Mon–Fri
  days_per_week: null,
  minutes_per_planned_day: 60,
  start_date: "2026-11-02", // Monday
  end_date: "2026-11-15",
  reason: "Why this, now.",
  created_by_review_id: null,
};

const ROW: ObjectiveRow = {
  id: "obj-1",
  title: "Ship Keel",
  description: null,
  why_now: "Why this, now.",
  success_criteria: "Today renders real effort.",
  plan_link: null,
  review_cadence: "weekly",
  from_parked_idea_id: null,
  segments: [SEG_0],
  status_events: [
    { occurred_on: "2026-11-02", change: "created", reason: null },
  ],
  daily_minutes: [],
  saved_reviews: [],
  notes: [],
};

/** Before the plan starts: no review window has closed. */
const TODAY = "2026-11-01";

function summary(row: ObjectiveRow, today = TODAY) {
  const r = assembleSummary(row, today);
  if (!r.ok) throw new Error("expected a summary");
  return r.value;
}

function detail(row: ObjectiveRow) {
  const r = assembleObjective(row, TODAY);
  if (!r.ok) throw new Error("expected an objective");
  return r.value;
}

describe("assembleSummary", () => {
  it("gives a new objective its schedule, dates, and 0 of a real target", () => {
    expect(summary(ROW)).toEqual({
      id: "obj-1",
      title: "Ship Keel",
      status: "active",
      schedule: {
        mode: "fixed",
        planned_weekdays: [1, 2, 3, 4, 5],
        minutes_per_planned_day: 60,
        label: "FIXED · MON–FRI · 1h 00m PER DAY",
      },
      start_date: "2026-11-02",
      end_date: "2026-11-15",
      next_review_on: null,
      reviews_due: 0,
      from_parking_lot: false,
      figures: {
        adherence_pct: 0,
        logged_minutes: 0,
        target_minutes: 600,
        planned_days: 10,
        planned_days_worked: 0,
        target_met_days: 0,
        extra_off_day_minutes: 0,
        over_target_minutes: 0,
        planned_weeks: 0,
        target_met_weeks: 0,
      },
    });
  });

  it("reads the status from the latest event: created and resumed are active", () => {
    const at = (...changes: string[]) =>
      summary({
        ...ROW,
        status_events: changes.map((change, i) => ({
          occurred_on: `2026-11-0${i + 2}`,
          change: change as "created",
          reason: null,
        })),
      }).status;
    expect(at("created")).toBe("active");
    expect(at("created", "paused")).toBe("paused");
    expect(at("created", "paused", "resumed")).toBe("active");
    expect(at("created", "completed")).toBe("completed");
    expect(at("created", "ended")).toBe("ended");
  });

  it("counts logged effort into the figures", () => {
    const f = summary({
      ...ROW,
      daily_minutes: [
        { local_date: "2026-11-02", minutes: 60 },
        { local_date: "2026-11-07", minutes: 30 }, // Saturday
      ],
    }).figures;
    expect(f).toMatchObject({
      logged_minutes: 90,
      adherence_pct: 10,
      extra_off_day_minutes: 30,
    });
  });

  it("marks an objective that came from the parking lot", () => {
    expect(
      summary({ ...ROW, from_parked_idea_id: "idea-1" }).from_parking_lot,
    ).toBe(true);
  });

  it("labels a flexible schedule by its day count", () => {
    const s = summary({
      ...ROW,
      segments: [
        {
          ...SEG_0,
          schedule_mode: "flexible",
          planned_weekdays: null,
          days_per_week: 3,
        },
      ],
    });
    expect(s.schedule).toEqual({
      mode: "flexible",
      days_per_week: 3,
      minutes_per_planned_day: 60,
      label: "FLEXIBLE · 3 DAYS/WEEK · 1h 00m PER DAY",
    });
    expect(s.figures.target_minutes).toBe(360); // two weeks × 3 days × 60
  });

  it("degrades a schedule missing its mode's field instead of throwing", () => {
    // Both are refused by plan_segment_mode, so only a direct call reaches this.
    const flexible = summary({
      ...ROW,
      segments: [
        {
          ...SEG_0,
          schedule_mode: "flexible",
          planned_weekdays: null,
          days_per_week: null,
        },
      ],
    });
    expect(flexible.schedule.days_per_week).toBe(0);
    const fixed = summary({
      ...ROW,
      segments: [{ ...SEG_0, planned_weekdays: null }],
    });
    expect(fixed.schedule.planned_weekdays).toEqual([]);
  });

  it("fails rather than guessing with no status events (invariant 16)", () => {
    expect(assembleSummary({ ...ROW, status_events: [] }, TODAY)).toEqual({
      ok: false,
      error: "malformed",
    });
  });

  it("fails with no segments: an objective without a plan is malformed", () => {
    expect(assembleSummary({ ...ROW, segments: [] }, TODAY)).toEqual({
      ok: false,
      error: "malformed",
    });
  });
});

describe("criteria_verdict", () => {
  it("is null until a plan-end review is saved, then the latest one's", () => {
    expect(detail(ROW).criteria_verdict).toBeNull();
    const saved = (
      period_end: string,
      kind: "weekly" | "plan_end",
      v: "met" | "not_met" | null,
    ) => ({
      id: period_end,
      outcome: null,
      period_start: period_end,
      period_end,
      kind,
      criteria_verdict: v,
    });
    expect(
      detail({
        ...ROW,
        saved_reviews: [
          saved("2026-11-08", "weekly", null),
          saved("2026-11-15", "plan_end", "not_met"),
          saved("2026-11-29", "plan_end", "met"),
        ],
      }).criteria_verdict,
    ).toBe("met");
  });
});

describe("next_review_on and reviews_due", () => {
  // Segment 0 runs Mon 2 Nov … Sun 15 Nov: Week 1 closes 8 Nov, End of plan 15 Nov.
  it("is the earliest closed, unsaved window, counting every one owed", () => {
    expect(summary(ROW, "2026-11-07")).toMatchObject({
      next_review_on: null,
      reviews_due: 0,
    });
    expect(summary(ROW, "2026-11-08")).toMatchObject({
      next_review_on: "2026-11-08",
      reviews_due: 1,
    });
    expect(summary(ROW, "2026-11-20")).toMatchObject({
      next_review_on: "2026-11-08",
      reviews_due: 2,
    });
  });

  it("skips a saved window", () => {
    expect(
      summary(
        {
          ...ROW,
          saved_reviews: [
            {
              id: "r1",
              outcome: null,
              period_start: "2026-11-02",
              period_end: "2026-11-08",
              kind: "weekly",
              criteria_verdict: null,
            },
          ],
        },
        "2026-11-20",
      ),
    ).toMatchObject({ next_review_on: "2026-11-15", reviews_due: 1 });
  });

  it("owes nothing while paused", () => {
    expect(
      summary(
        {
          ...ROW,
          status_events: [
            ...ROW.status_events,
            { occurred_on: "2026-11-10", change: "paused", reason: null },
          ],
        },
        "2026-11-20",
      ),
    ).toMatchObject({ next_review_on: null, reviews_due: 0 });
  });
});

describe("assembleObjective — with an extension", () => {
  const SEG_1: ObjectiveSegmentRow = {
    ...SEG_0,
    id: "seg-1",
    seq: 1,
    planned_weekdays: 0b10101, // Mon, Wed, Fri
    minutes_per_planned_day: 90,
    start_date: "2026-11-16",
    end_date: "2026-11-29",
    reason: "Extending rather than restarting.",
    created_by_review_id: "review-1",
  };
  // Given out of order: assembly sorts by seq.
  const EXTENDED: ObjectiveRow = {
    ...ROW,
    description: "Core Python, then DSA.",
    plan_link: "https://example.com/plan",
    segments: [SEG_1, SEG_0],
    status_events: [
      { occurred_on: "2026-11-02", change: "created", reason: null },
      { occurred_on: "2026-11-16", change: "paused", reason: "Ill." },
    ],
  };

  it("takes dates and the schedule shown from the segments, by seq", () => {
    const o = detail(EXTENDED);
    expect(o.start_date).toBe("2026-11-02");
    expect(o.end_date).toBe("2026-11-29");
    expect(o.original_end_date).toBe("2026-11-15");
    expect(o.extension_count).toBe(1);
    expect(o.schedule.label).toBe("FIXED · MON, WED, FRI · 1h 30m PER DAY");
  });

  it("carries the stored text, and the description only when set", () => {
    const o = detail(EXTENDED);
    expect(o).toMatchObject({
      why_now: "Why this, now.",
      success_criteria: "Today renders real effort.",
      plan_link: "https://example.com/plan",
      review_cadence: "weekly",
      description: "Core Python, then DSA.",
    });
    expect("description" in detail(ROW)).toBe(false);
  });

  it("lists every segment with its own schedule", () => {
    expect(detail(EXTENDED).segments).toEqual([
      {
        id: "seg-0",
        seq: 0,
        schedule: {
          mode: "fixed",
          planned_weekdays: [1, 2, 3, 4, 5],
          minutes_per_planned_day: 60,
          label: "FIXED · MON–FRI · 1h 00m PER DAY",
        },
        start_date: "2026-11-02",
        end_date: "2026-11-15",
        reason: "Why this, now.",
        created_by_review_id: null,
      },
      {
        id: "seg-1",
        seq: 1,
        schedule: {
          mode: "fixed",
          planned_weekdays: [1, 3, 5],
          minutes_per_planned_day: 90,
          label: "FIXED · MON, WED, FRI · 1h 30m PER DAY",
        },
        start_date: "2026-11-16",
        end_date: "2026-11-29",
        reason: "Extending rather than restarting.",
        created_by_review_id: "review-1",
      },
    ]);
  });

  it("merges status events and extensions by date, events first on a tie", () => {
    expect(detail(EXTENDED).status_history).toEqual([
      { occurred_on: "2026-11-02", change: "created", reason: null },
      { occurred_on: "2026-11-16", change: "paused", reason: "Ill." },
      {
        occurred_on: "2026-11-16",
        change: "extended",
        reason: "Extending rather than restarting.",
        new_end_date: "2026-11-29",
      },
    ]);
  });

  it("orders an extension before a later event", () => {
    const history = detail({
      ...EXTENDED,
      status_events: [
        { occurred_on: "2026-11-02", change: "created", reason: null },
        { occurred_on: "2026-11-20", change: "ended", reason: null },
      ],
    }).status_history.map((h) => h.change);
    expect(history).toEqual(["created", "extended", "ended"]);
  });

  it("has an empty-of-extensions history for a new objective", () => {
    expect(detail(ROW).status_history).toEqual([
      { occurred_on: "2026-11-02", change: "created", reason: null },
    ]);
    expect(detail(ROW).extension_count).toBe(0);
  });

  it("fails rather than guessing when malformed", () => {
    expect(assembleObjective({ ...ROW, status_events: [] }, TODAY).ok).toBe(
      false,
    );
  });
});

describe("parseStatusFilter", () => {
  it("defaults to all and accepts each status", () => {
    expect(parseStatusFilter(null)).toBe("all");
    for (const s of ["all", "active", "paused", "completed", "ended"]) {
      expect(parseStatusFilter(s)).toBe(s);
    }
  });

  it("refuses anything else, including the stored-only changes", () => {
    for (const s of ["", "created", "resumed", "ACTIVE"]) {
      expect(parseStatusFilter(s)).toBeNull();
    }
  });
});

describe("assembleList", () => {
  const PAUSED: ObjectiveRow = {
    ...ROW,
    id: "obj-2",
    status_events: [
      ...ROW.status_events,
      { occurred_on: "2026-11-03", change: "paused", reason: null },
    ],
  };

  it("returns every objective for all, and filters by status", () => {
    const ids = (filter: Parameters<typeof assembleList>[1]) => {
      const r = assembleList([ROW, PAUSED], filter, TODAY);
      return r.ok ? r.value.map((o) => o.id) : r.error;
    };
    expect(ids("all")).toEqual(["obj-1", "obj-2"]);
    expect(ids("active")).toEqual(["obj-1"]);
    expect(ids("paused")).toEqual(["obj-2"]);
    expect(ids("ended")).toEqual([]);
  });

  it("fails the whole list when one objective is malformed", () => {
    expect(
      assembleList([ROW, { ...PAUSED, status_events: [] }], "active", TODAY),
    ).toEqual({ ok: false, error: "malformed" });
  });
});
