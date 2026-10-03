import { describe, expect, it } from "vitest";
import { scheduleLabel } from "./scheduleLabel";

describe("scheduleLabel", () => {
  it("labels a contiguous fixed schedule as a range", () => {
    expect(
      scheduleLabel({
        mode: "fixed",
        plannedWeekdays: [1, 2, 3, 4, 5],
        minutesPerPlannedDay: 120,
      }),
    ).toBe("FIXED · MON–FRI · 2h 00m PER DAY");
  });

  it("labels a non-contiguous fixed schedule as a list", () => {
    expect(
      scheduleLabel({
        mode: "fixed",
        plannedWeekdays: [1, 3, 5],
        minutesPerPlannedDay: 90,
      }),
    ).toBe("FIXED · MON, WED, FRI · 1h 30m PER DAY");
  });

  it("labels a flexible schedule by days per week", () => {
    expect(
      scheduleLabel({
        mode: "flexible",
        daysPerWeek: 4,
        minutesPerPlannedDay: 60,
      }),
    ).toBe("FLEXIBLE · 4 DAYS/WEEK · 1h 00m PER DAY");
  });

  it("labels a single fixed day by name, not as a range", () => {
    expect(
      scheduleLabel({
        mode: "fixed",
        plannedWeekdays: [3],
        minutesPerPlannedDay: 45,
      }),
    ).toBe("FIXED · WED · 0h 45m PER DAY");
  });

  // The next three are reachable only by a direct call: the schema requires a
  // bitmask of 1–127 for a fixed segment and days_per_week for a flexible one.
  // They pin that the label degrades to something readable instead of throwing.

  it("leaves the days blank for a fixed schedule with no weekdays", () => {
    expect(
      scheduleLabel({
        mode: "fixed",
        plannedWeekdays: [],
        minutesPerPlannedDay: 60,
      }),
    ).toBe("FIXED ·  · 1h 00m PER DAY");
  });

  it("treats omitted weekdays as none", () => {
    expect(scheduleLabel({ mode: "fixed", minutesPerPlannedDay: 60 })).toBe(
      "FIXED ·  · 1h 00m PER DAY",
    );
  });

  it("shows 0 days a week for a flexible schedule with no count", () => {
    expect(scheduleLabel({ mode: "flexible", minutesPerPlannedDay: 60 })).toBe(
      "FLEXIBLE · 0 DAYS/WEEK · 1h 00m PER DAY",
    );
  });
});
