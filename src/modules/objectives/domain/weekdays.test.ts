import { describe, expect, it } from "vitest";
import { bitmaskToWeekdays, weekdaysToBitmask } from "./weekdays";

/**
 * The one conversion between the stored bitmask (plan_segment.planned_weekdays)
 * and ISO weekdays, 1 = Monday … 7 = Sunday. The seed writes through it, so a
 * wrong bit here plans the wrong days everywhere.
 */
describe("weekdaysToBitmask", () => {
  it("packs Mon–Fri into 31, the seed's schedule", () => {
    expect(weekdaysToBitmask([1, 2, 3, 4, 5])).toBe(31);
  });

  it("gives 0 for no days", () => {
    // 0 is refused by plan_segment_planned_weekdays (1–127); the conversion
    // itself stays total and leaves the refusal to the schema.
    expect(weekdaysToBitmask([])).toBe(0);
  });

  it("puts Sunday (7) in the top bit, 64", () => {
    expect(weekdaysToBitmask([7])).toBe(64);
  });

  it("ignores a repeated day rather than double-counting it", () => {
    expect(weekdaysToBitmask([1, 1, 3])).toBe(weekdaysToBitmask([1, 3]));
  });

  it("does not depend on the order the days arrive in", () => {
    expect(weekdaysToBitmask([5, 1, 3])).toBe(weekdaysToBitmask([1, 3, 5]));
  });
});

describe("weekdaysToBitmask ↔ bitmaskToWeekdays", () => {
  it.each([1, 2, 3, 4, 5, 6, 7])("round-trips the single day %i", (day) => {
    expect(bitmaskToWeekdays(weekdaysToBitmask([day]))).toEqual([day]);
  });

  it("round-trips Mon–Fri and every day of the week", () => {
    expect(bitmaskToWeekdays(weekdaysToBitmask([1, 2, 3, 4, 5]))).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(bitmaskToWeekdays(127)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekdaysToBitmask([1, 2, 3, 4, 5, 6, 7])).toBe(127);
  });
});
