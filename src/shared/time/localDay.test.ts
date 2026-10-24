import { describe, expect, it } from "vitest";
import { localDayOf, localTimeOf } from "./localDay";

/**
 * NFR-12, the half v1 keeps: the calendar day an instant belongs to depends
 * ONLY on the zone it is asked about — the day the client meant — never on the
 * process (server) zone. localDayOf is the one place that boundary is computed
 * (ADR-001, shared/time).
 *
 * These assertions are run under four TZ values by scripts/test-tz.mjs
 * (baseline UTC, the half-hour Asia/Kolkata, UTC+14 Pacific/Kiritimati, and
 * UTC-8 America/Los_Angeles). The correct implementation gives identical
 * results under all four; a difference between runs is the bug. The boundary
 * cases below are chosen so a "use the server's zone" mistake is caught by a
 * NON-UTC run — the off-by-one a UTC-only pipeline would ship.
 *
 * This is the kept half only: no DST boundary, no timezone travel (deferred to
 * v2, NFR-12).
 */
describe("localDayOf — the day depends only on the client's zone", () => {
  it("keeps a 23:55 IST entry on its own local date", () => {
    // 2026-09-18 23:55 in Asia/Kolkata is 2026-09-18 18:25Z. Its UTC day is
    // the 18th too, so a server-zone mistake stays hidden under UTC — but a
    // UTC+14 run sees 2026-09-19 and catches it.
    const instant = new Date("2026-09-18T18:25:00Z");
    expect(localDayOf(instant, "Asia/Kolkata")).toBe("2026-09-18");
  });

  it("keeps a 00:30 IST entry on its own local date (UTC is the previous day)", () => {
    // 2026-09-18 00:30 in Asia/Kolkata is 2026-09-17 19:00Z: the intended
    // local day (18th) is NOT the UTC day (17th). Only the passed zone is
    // right; a server-zone mistake is caught under UTC and under UTC-8.
    const instant = new Date("2026-09-17T19:00:00Z");
    expect(localDayOf(instant, "Asia/Kolkata")).toBe("2026-09-18");
  });

  it("resolves the same instant to the correct day in each zone", () => {
    const noonUtc = new Date("2026-09-18T12:00:00Z");
    expect(localDayOf(noonUtc, "UTC")).toBe("2026-09-18");
    expect(localDayOf(noonUtc, "Pacific/Kiritimati")).toBe("2026-09-19"); // UTC+14
    expect(localDayOf(noonUtc, "America/Los_Angeles")).toBe("2026-09-18"); // UTC-8
    expect(localDayOf(noonUtc, "Asia/Kolkata")).toBe("2026-09-18"); // +05:30
  });
});

describe("localTimeOf — the clock depends only on the client's zone", () => {
  it("reads the same instant on each zone's own clock", () => {
    const instant = new Date("2026-09-18T18:25:40Z");
    expect(localTimeOf(instant, "UTC")).toBe("18:25");
    expect(localTimeOf(instant, "Asia/Kolkata")).toBe("23:55"); // +05:30
    expect(localTimeOf(instant, "Pacific/Kiritimati")).toBe("08:25"); // UTC+14
    expect(localTimeOf(instant, "America/Los_Angeles")).toBe("11:25"); // UTC-7
  });

  it("gives midnight as 00:00, not 24:00", () => {
    expect(localTimeOf(new Date("2026-09-17T18:30:00Z"), "Asia/Kolkata")).toBe(
      "00:00",
    );
  });
});
