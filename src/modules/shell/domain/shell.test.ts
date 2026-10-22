import { describe, expect, it } from "vitest";
import {
  currentPlace,
  initialOf,
  PLACES,
  themeCookie,
  themeFrom,
} from "./shell";

describe("PLACES", () => {
  it("lists the four places in the design's order", () => {
    expect(PLACES.map((p) => p.label)).toEqual([
      "Today",
      "Objectives",
      "Deviations",
      "Parking lot",
    ]);
  });
});

describe("currentPlace", () => {
  it("is Today for / exactly", () => {
    expect(currentPlace("/")).toBe("today");
  });

  it("finds each other place by its path", () => {
    expect(currentPlace("/objectives")).toBe("objectives");
    expect(currentPlace("/deviations")).toBe("deviations");
    expect(currentPlace("/parking-lot")).toBe("parking");
  });

  it("keeps a place for anything under it", () => {
    expect(currentPlace("/objectives/abc")).toBe("objectives");
  });

  it("is none for a longer name or a path outside the four", () => {
    expect(currentPlace("/objectivesx")).toBeNull();
    expect(currentPlace("/sign-in")).toBeNull();
  });
});

describe("initialOf", () => {
  it("is the first letter, upper-cased", () => {
    expect(initialOf("rohit")).toBe("R");
  });

  it("skips leading space and keeps an accented letter whole", () => {
    expect(initialOf(" émile")).toBe("É");
  });

  it("is a question mark for an empty name", () => {
    expect(initialOf("")).toBe("?");
    expect(initialOf("   ")).toBe("?");
  });
});

describe("themeFrom", () => {
  it("reads light and dark", () => {
    expect(themeFrom("light")).toBe("light");
    expect(themeFrom("dark")).toBe("dark");
  });

  it("is no choice for anything else, System included", () => {
    expect(themeFrom("system")).toBeNull();
    expect(themeFrom("")).toBeNull();
    expect(themeFrom(undefined)).toBeNull();
  });
});

describe("themeCookie", () => {
  it("keeps the choice for a year, site-wide", () => {
    expect(themeCookie("dark", false)).toBe(
      "keel_theme=dark; Path=/; Max-Age=31536000; SameSite=Lax",
    );
  });

  it("is Secure on https", () => {
    expect(themeCookie("light", true)).toBe(
      "keel_theme=light; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
  });
});
