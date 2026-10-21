import { describe, expect, it } from "vitest";
import { effortDayRefusal } from "./effortDay";

describe("effortDayRefusal — effort is fixed once its day is over", () => {
  it("allows today", () => {
    expect(effortDayRefusal("2026-10-21", "2026-10-21")).toBeNull();
  });

  it("refuses yesterday and tomorrow", () => {
    expect(effortDayRefusal("2026-10-20", "2026-10-21")).toBe("not_today");
    expect(effortDayRefusal("2026-10-22", "2026-10-21")).toBe("not_today");
  });
});
