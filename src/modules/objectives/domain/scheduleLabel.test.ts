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
});
