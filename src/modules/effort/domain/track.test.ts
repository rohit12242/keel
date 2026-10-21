import { describe, expect, it } from "vitest";
import { trackOf } from "./track";

describe("trackOf — docs/domain/adherence.md, Track", () => {
  it.each([
    [100, "on_track"],
    [80, "on_track"],
    [79, "at_risk"],
    [60, "at_risk"],
    [59, "behind"],
    [0, "behind"],
  ] as const)("reads %i%% as %s", (pct, band) => {
    expect(trackOf({ adherence_pct: pct }, true)).toBe(band);
  });

  it("says nothing before a slot has ended", () => {
    expect(trackOf({ adherence_pct: 0 }, false)).toBeNull();
    expect(trackOf({ adherence_pct: 100 }, false)).toBeNull();
  });
});
