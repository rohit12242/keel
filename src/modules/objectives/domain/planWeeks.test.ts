import { describe, expect, it } from "vitest";
import { figures } from "@/modules/effort/domain/adherence";
import type { SegmentForSlots } from "./generateSlots";
import { planSlots } from "./planSlots";
import type { StatusEventRow } from "./statusTimeline";
import { planWeeks } from "./planWeeks";
import { reviewWindows } from "@/modules/reviews/domain/reviewWindows";

const created: StatusEventRow[] = [
  { occurred_on: "2026-08-23", change: "created" },
];
// Sun 23 Aug … Mon 21 Sep: 30 days, Mon–Sat, 2 h a day.
const PLAN: SegmentForSlots = {
  scheduleMode: "fixed",
  plannedWeekdays: [1, 2, 3, 4, 5, 6],
  minutesPerPlannedDay: 120,
  startDate: "2026-08-23",
  endDate: "2026-09-21",
};
const SPAN = { id: "s0", start_date: "2026-08-23", end_date: "2026-09-21" };

describe("planWeeks — docs/domain/adherence.md, Plan weeks (G16)", () => {
  it("is the weekly review windows: Monday to Sunday, a 1-day first and last week joined", () => {
    const weeks = planWeeks([SPAN], planSlots([PLAN], created), {});
    expect(weeks.map((w) => [w.period_start, w.period_end])).toEqual([
      ["2026-08-23", "2026-08-30"],
      ["2026-08-31", "2026-09-06"],
      ["2026-09-07", "2026-09-13"],
      ["2026-09-14", "2026-09-21"],
    ]);
    expect(
      weeks.map(({ period_start, period_end }) => ({
        period_start,
        period_end,
      })),
    ).toEqual(
      reviewWindows("weekly", SPAN).map(({ period_start, period_end }) => ({
        period_start,
        period_end,
      })),
    );
  });

  it("clips weeks to an extension, which tiles the calendar on its own", () => {
    const ext = { id: "s1", start_date: "2026-09-22", end_date: "2026-10-01" };
    const weeks = planWeeks([SPAN, ext], [], {});
    expect(weeks.slice(-2).map((w) => [w.period_start, w.period_end])).toEqual([
      ["2026-09-22", "2026-09-27"],
      ["2026-09-28", "2026-10-01"],
    ]);
  });

  it("gives each week its figures, which add up to the whole run's", () => {
    const slots = planSlots([PLAN], created);
    const daily = {
      "2026-08-24": 120,
      "2026-08-25": 150, // 30 over
      "2026-08-30": 45, // Sunday: extra, in the joined first week
      "2026-09-01": 60,
      "2026-09-21": 120,
    };
    const weeks = planWeeks([SPAN], slots, daily);
    expect(weeks[0].figures).toMatchObject({
      logged_minutes: 315,
      target_minutes: 720,
      over_target_minutes: 30,
    });
    expect(weeks[0].figures.extra_off_day_minutes).toBe(45);
    const whole = figures(slots, daily);
    for (const key of [
      "logged_minutes",
      "target_minutes",
      "over_target_minutes",
      "extra_off_day_minutes",
      "planned_days",
      "target_met_days",
    ] as const) {
      expect(weeks.reduce((sum, w) => sum + w.figures[key], 0)).toBe(
        whole[key],
      );
    }
  });
});
