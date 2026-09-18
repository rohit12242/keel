import { describe, expect, it } from "vitest";
import { types } from "pg";
import { configureDbDateParsing } from "./db-types";

/**
 * NFR-12: a DATE column must come back as a 'YYYY-MM-DD' string, not a JS Date.
 * pg's default builds a Date at local midnight — the off-by-one hazard. This
 * pins the parser so a revert to the default shows up here rather than as a
 * silent wrong-day for a user in a distant zone.
 */
describe("configureDbDateParsing", () => {
  it("returns a DATE column as the raw string, unchanged", () => {
    configureDbDateParsing();
    const parse = types.getTypeParser(types.builtins.DATE);
    const parsed = parse("2026-09-18");
    expect(parsed).toBe("2026-09-18");
    expect(typeof parsed).toBe("string");
  });

  it("never yields a Date (which would carry the runtime zone)", () => {
    configureDbDateParsing();
    const parse = types.getTypeParser(types.builtins.DATE);
    expect(parse("2026-01-01") instanceof Date).toBe(false);
  });
});
