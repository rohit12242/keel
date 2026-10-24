import { describe, expect, it } from "vitest";
import {
  effortDayRefusal,
  FUTURE_GRACE_MINUTES,
  futureRefusal,
} from "./effortDay";

describe("effortDayRefusal — effort is fixed once its day is over", () => {
  it("allows today", () => {
    expect(effortDayRefusal("2026-10-21", "2026-10-21")).toBeNull();
  });

  it("refuses yesterday and tomorrow", () => {
    expect(effortDayRefusal("2026-10-20", "2026-10-21")).toBe("not_today");
    expect(effortDayRefusal("2026-10-22", "2026-10-21")).toBe("not_today");
  });
});

describe("futureRefusal — effort is logged once it has happened", () => {
  it("allows an entry that ended before now, or ends now", () => {
    expect(
      futureRefusal({ occurred_at_local: "09:00", minutes: 60 }, "11:00"),
    ).toBeNull();
    expect(
      futureRefusal({ occurred_at_local: "10:00", minutes: 60 }, "11:00"),
    ).toBeNull();
  });

  it("allows an end inside the grace, and refuses one a minute past it", () => {
    const at = (minutes: number) =>
      futureRefusal({ occurred_at_local: "10:00", minutes }, "11:00");
    expect(at(60 + FUTURE_GRACE_MINUTES)).toBeNull();
    expect(at(61 + FUTURE_GRACE_MINUTES)).toBe("in_future");
  });

  it("refuses an entry that has not started yet", () => {
    expect(
      futureRefusal({ occurred_at_local: "15:00", minutes: 30 }, "11:00"),
    ).toBe("in_future");
  });

  it("has nothing to judge without a start time", () => {
    expect(futureRefusal({ minutes: 600 }, "00:01")).toBeNull();
  });
});
