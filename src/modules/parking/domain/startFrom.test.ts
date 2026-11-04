import { describe, expect, it } from "vitest";
import type { ParkedIdea } from "@/shared/contract";
import {
  approvedIdeas,
  approvedLine,
  checkStart,
  fillFrom,
  ideaMeta,
  search,
  showSearch,
  START_ERROR,
} from "./startFrom";

const TODAY = "2026-09-05";

const idea = (over: Partial<ParkedIdea>): ParkedIdea => ({
  id: "i1",
  idea: "Build a typing tutor",
  why: "Saw a demo.",
  caught_on: "2026-08-31",
  locked_until: "2026-09-21",
  locked: false,
  notes: [],
  verdict: "approved",
  verdict_on: "2026-09-22",
  note: null,
  became_objective_id: null,
  decided_early: false,
  ...over,
});

const a = idea({ id: "a", idea: "Typing tutor", why: "Saw a demo." });
const b = idea({ id: "b", idea: "Learn Go", why: "A TEAM uses it." });

describe("the card", () => {
  it("offers approved ideas only, in the API's order", () => {
    const parked = idea({ id: "p", verdict: "parked" });
    expect(approvedIdeas([b, parked, a])).toEqual([b, a]);
  });

  it("says how many are waiting", () => {
    expect(approvedLine(0)).toBe("None approved yet in the Parking lot.");
    expect(approvedLine(1)).toBe(
      "1 idea in the Parking lot is approved and waiting.",
    );
    expect(approvedLine(2)).toBe(
      "2 ideas in the Parking lot are approved and waiting.",
    );
  });

  it("dates each idea", () => {
    expect(ideaMeta(a, TODAY)).toBe("Caught 31 Aug · approved 22 Sep");
  });
});

describe("search", () => {
  it("shows only with more than one idea", () => {
    expect(showSearch([a])).toBe(false);
    expect(showSearch([a, b])).toBe(true);
  });

  it("matches the idea or its why, ignoring case", () => {
    expect(search([a, b], "")).toEqual([a, b]);
    expect(search([a, b], " team ")).toEqual([b]);
    expect(search([a, b], "TYPING")).toEqual([a]);
    expect(search([a, b], "nothing")).toEqual([]);
  });
});

describe("fillFrom", () => {
  it("fills empty fields, cut to their limits", () => {
    const long = idea({ idea: "x".repeat(120), why: "y".repeat(300) });
    expect(fillFrom({ name: "", why: "" }, null, long)).toEqual({
      name: "x".repeat(80),
      why: "y".repeat(280),
    });
  });

  it("replaces what the previous pick filled, and keeps what was typed", () => {
    const filled = fillFrom({ name: "", why: "" }, null, a);
    expect(fillFrom(filled, a, b)).toEqual({ name: b.idea, why: b.why });
    expect(fillFrom({ ...filled, name: "My own name" }, a, b)).toEqual({
      name: "My own name",
      why: b.why,
    });
    expect(fillFrom({ name: "Typed", why: "Typed too" }, null, a)).toEqual({
      name: "Typed",
      why: "Typed too",
    });
  });
});

describe("checkStart", () => {
  it("needs a choice, and with an idea, the idea", () => {
    expect(checkStart(null, null)).toBe(START_ERROR);
    expect(checkStart("idea", null)).toBe(START_ERROR);
    expect(checkStart("idea", "a")).toBeNull();
    expect(checkStart("scratch", null)).toBeNull();
  });
});
