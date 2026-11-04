import { describe, expect, it } from "vitest";
import type { ParkedIdea } from "@/shared/contract";
import {
  checkIdea,
  IDEA_MAX,
  lockNote,
  NOT_PARKED,
  parkedToast,
  WHY_MAX,
} from "./parkIdea";

const TODAY = "2026-09-05";

const design = {
  id: "o1",
  title: "System design",
  start_date: "2026-08-03",
  end_date: "2026-11-02",
};

describe("checkIdea", () => {
  it("gives both errors at once, the idea first", () => {
    expect(checkIdea({ idea: "", why: " " }, TODAY)).toEqual({
      ok: false,
      errors: { idea: "Enter the idea.", why: "Add why it grabbed you." },
      first: "idea",
    });
    expect(checkIdea({ idea: "Tutor", why: "" }, TODAY)).toEqual({
      ok: false,
      errors: { why: "Add why it grabbed you." },
      first: "why",
    });
  });

  it("sends the text as typed, caught on the day given", () => {
    const idea = "x".repeat(IDEA_MAX);
    const why = ` ${"y".repeat(WHY_MAX - 1)}`;
    expect(checkIdea({ idea, why }, TODAY)).toEqual({
      ok: true,
      body: { idea, why, caught_on: TODAY },
    });
  });
});

describe("lockNote", () => {
  it("says nothing until the API answers", () => {
    expect(lockNote(TODAY, null, [design])).toBeNull();
  });

  it("opens straight away with nothing running", () => {
    expect(lockNote(TODAY, TODAY, [])).toEqual({
      tone: "muted",
      text: "No objectives are running, so it opens straight away.",
    });
  });

  it("gives the API's date, naming the objective that sets it", () => {
    expect(lockNote(TODAY, "2026-11-02", [design])).toEqual({
      tone: "caution",
      text: "Locked until 2 Nov, the earliest end date among the objectives running today (System design). Taking it or dropping it before then is recorded as early, not blocked.",
    });
    expect(lockNote(TODAY, "2026-11-03", [design])?.text).toBe(
      "Locked until 3 Nov, the earliest end date among the objectives running today. Taking it or dropping it before then is recorded as early, not blocked.",
    );
  });
});

describe("parkedToast", () => {
  const parked = {
    caught_on: TODAY,
    locked_until: "2026-11-02",
  } as ParkedIdea;

  it("says when it opens, or just Parked", () => {
    expect(parkedToast(parked, TODAY)).toBe("Parked. Locked until 2 Nov.");
    expect(parkedToast({ ...parked, locked_until: TODAY }, TODAY)).toBe(
      "Parked.",
    );
    expect(NOT_PARKED).toMatch(/Nothing was saved/);
  });
});
