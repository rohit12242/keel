import { describe, expect, it } from "vitest";
import { committedMinutesPerWeek } from "./committedMinutes";
import type { ObjectiveRow, ObjectiveSegmentRow } from "./rows";
import type { StatusChange } from "./statusTimeline";

const segment = (
  over: Partial<ObjectiveSegmentRow> = {},
): ObjectiveSegmentRow => ({
  id: "s",
  seq: 0,
  schedule_mode: "fixed",
  planned_weekdays: 31, // Mon–Fri
  days_per_week: null,
  minutes_per_planned_day: 60,
  start_date: "2026-09-14",
  end_date: "2026-10-11",
  reason: "r",
  created_by_review_id: null,
  ...over,
});

const row = (
  segments: ObjectiveSegmentRow[],
  changes: StatusChange[] = ["created"],
): ObjectiveRow => ({
  id: "o",
  title: "t",
  description: null,
  why_now: "w",
  success_criteria: "c",
  plan_link: null,
  review_cadence: "weekly",
  from_parked_idea_id: null,
  segments,
  status_events: changes.map((change, i) => ({
    occurred_on: `2026-09-${14 + i}`,
    change,
    reason: null,
  })),
  daily_minutes: [],
  saved_reviews: [],
  notes: [],
});

describe("committedMinutesPerWeek", () => {
  it("sums fixed weekdays × minutes and flexible days × minutes", () => {
    expect(
      committedMinutesPerWeek(
        [
          row([segment()]),
          row([
            segment({
              schedule_mode: "flexible",
              planned_weekdays: null,
              days_per_week: 3,
              minutes_per_planned_day: 30,
            }),
          ]),
        ],
        "2026-09-20",
      ),
    ).toBe(5 * 60 + 3 * 30);
  });

  it("uses the segment in force today, not the first", () => {
    const extended = row([
      segment(),
      segment({
        seq: 1,
        planned_weekdays: 1 | 4, // Mon, Wed
        minutes_per_planned_day: 90,
        start_date: "2026-10-12",
        end_date: "2026-11-08",
      }),
    ]);
    expect(committedMinutesPerWeek([extended], "2026-10-11")).toBe(300);
    expect(committedMinutesPerWeek([extended], "2026-10-12")).toBe(180);
  });

  it("counts nothing for a paused, completed or ended objective", () => {
    for (const last of ["paused", "completed", "ended"] as const) {
      expect(
        committedMinutesPerWeek(
          [row([segment()], ["created", last])],
          "2026-09-20",
        ),
      ).toBe(0);
    }
    expect(
      committedMinutesPerWeek(
        [row([segment()], ["created", "paused", "resumed"])],
        "2026-09-20",
      ),
    ).toBe(300);
  });

  it("counts nothing before the plan starts or after it ends", () => {
    expect(committedMinutesPerWeek([row([segment()])], "2026-09-13")).toBe(0);
    expect(committedMinutesPerWeek([row([segment()])], "2026-10-12")).toBe(0);
  });

  it("is zero with no objectives, and treats missing schedule numbers as none", () => {
    expect(committedMinutesPerWeek([], "2026-09-20")).toBe(0);
    expect(
      committedMinutesPerWeek(
        [
          row([segment({ planned_weekdays: null })]),
          row([segment({ schedule_mode: "flexible", days_per_week: null })]),
        ],
        "2026-09-20",
      ),
    ).toBe(0);
  });
});
