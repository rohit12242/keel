import { describe, expect, it } from "vitest";
import type { ParkedIdea } from "@/shared/contract";
import {
  approvedLine,
  caught,
  checkDrop,
  decidable,
  DROP_WHY_MAX,
  EMPTY,
  emptyFilter,
  filterOf,
  filters,
  FINAL,
  heldIdea,
  inFilter,
  lockRule,
  lockSetter,
  pill,
  shortDate,
  stateOf,
  takenLine,
  verdictBody,
  verdictToast,
} from "./parkingView";

// The design's today: Sat 5 Sep 2026.
const TODAY = "2026-09-05";

const idea = (over: Partial<ParkedIdea> = {}): ParkedIdea => ({
  id: "i1",
  idea: "Build a typing tutor",
  why: "Saw a demo and wanted one.",
  caught_on: "2026-08-31",
  locked_until: "2026-09-21",
  locked: true,
  notes: [],
  verdict: "parked",
  verdict_on: "2026-08-31",
  note: null,
  became_objective_id: null,
  decided_early: false,
  ...over,
});

const design = {
  id: "o1",
  title: "System design",
  start_date: "2026-08-03",
  end_date: "2026-09-21",
};

describe("shortDate", () => {
  it("reads 31 Aug, with the year when it isn't today's", () => {
    expect(shortDate("2026-08-31", TODAY)).toBe("31 Aug");
    expect(shortDate("2027-01-05", TODAY)).toBe("5 Jan 2027");
  });
});

describe("stateOf and pill", () => {
  it("a parked idea is locked until its lock lifts, with the ⓘ", () => {
    expect(stateOf(idea())).toBe("locked");
    expect(pill(idea(), TODAY)).toEqual({
      state: "locked",
      row: "Locked · opens 21 Sep",
      detail: "Locked · opens 21 Sep",
      info: true,
    });
  });

  it("then open, with the day it opened in the detail", () => {
    expect(pill(idea({ locked: false }), TODAY)).toEqual({
      state: "open",
      row: "Open · decide now",
      detail: "Open since 21 Sep · decide now",
      info: false,
    });
  });

  it("decided ideas carry their verdict's date, and early when it was", () => {
    const approved = idea({ verdict: "approved", verdict_on: "2026-09-22" });
    expect(pill(approved, TODAY).row).toBe("Approved 22 Sep");
    expect(pill({ ...approved, decided_early: true }, TODAY).detail).toBe(
      "Approved 22 Sep · early",
    );
    expect(
      pill(idea({ verdict: "taken", decided_early: true }), TODAY),
    ).toEqual({
      state: "taken",
      row: "Taken 31 Aug · early",
      detail: "Taken 31 Aug · early",
      info: false,
    });
    expect(
      pill(idea({ verdict: "dropped", verdict_on: "2026-09-21" }), TODAY).row,
    ).toBe("Dropped 21 Sep");
  });
});

describe("the lock rule", () => {
  it("names the objective whose end set the lock", () => {
    expect(lockSetter("2026-09-21", "2026-08-31", [design])).toBe(
      "System design",
    );
    expect(lockRule(idea({ caught_on: "2026-09-14" }), [design], TODAY)).toBe(
      "Locked until 21 Sep, the earliest end date among the objectives running on 14 Sep, the day you caught it (System design). Deciding earlier is recorded as early.",
    );
  });

  it("leaves the name out when none matches", () => {
    // One that started after the idea was caught didn't set its lock.
    const later = { ...design, start_date: "2026-09-01" };
    expect(lockSetter("2026-09-21", "2026-08-31", [later])).toBeNull();
    expect(lockRule(idea(), [], TODAY)).toBe(
      "Locked until 21 Sep, the earliest end date among the objectives running on 31 Aug, the day you caught it. Deciding earlier is recorded as early.",
    );
  });
});

describe("the detail's lines", () => {
  it("caught and approved", () => {
    expect(caught(idea(), TODAY)).toBe("Caught 31 Aug");
    expect(
      approvedLine(
        idea({ verdict: "approved", verdict_on: "2026-09-22" }),
        TODAY,
      ),
    ).toBe(
      "Approved on 22 Sep. It moves to Taken when you pick it while creating an objective.",
    );
  });

  it("taken: early or not, with the objective's dates when found", () => {
    const taken = idea({ verdict: "taken", decided_early: true });
    const objective = {
      ...design,
      start_date: "2026-09-01",
      end_date: "2026-11-02",
    };
    expect(takenLine(taken, objective, TODAY)).toBe(
      "Became an objective on 31 Aug, before it opened on 21 Sep. Runs 1 Sep – 2 Nov.",
    );
    expect(
      takenLine({ ...taken, decided_early: false }, undefined, TODAY),
    ).toBe("Became an objective on 31 Aug.");
  });

  it("only parked and approved can still be decided", () => {
    expect(decidable(idea())).toBe(true);
    expect(decidable(idea({ verdict: "approved" }))).toBe(true);
    expect(decidable(idea({ verdict: "taken" }))).toBe(false);
    expect(decidable(idea({ verdict: "dropped" }))).toBe(false);
    expect(FINAL).toBe("The verdict is final. You can keep adding notes.");
  });
});

describe("held verdicts", () => {
  it("reads as sent: the verdict, its day, and early before the lock lifts", () => {
    const held = heldIdea(idea(), "approved", null, "2026-09-05");
    expect(held).toMatchObject({
      verdict: "approved",
      verdict_on: "2026-09-05",
      decided_early: true,
    });
    // On the day it opens, it isn't early.
    expect(
      heldIdea(idea(), "dropped", "Lost interest", "2026-09-21"),
    ).toMatchObject({ note: "Lost interest", decided_early: false });
    // Back to parked is never early.
    expect(
      heldIdea(idea({ verdict: "approved" }), "parked", null, "2026-09-05")
        .decided_early,
    ).toBe(false);
  });

  it("the body carries a note only when there is one, as typed", () => {
    expect(verdictBody("approved", TODAY, null)).toEqual({
      verdict: "approved",
      occurred_on: TODAY,
    });
    expect(verdictBody("dropped", TODAY, " Lost it ")).toEqual({
      verdict: "dropped",
      occurred_on: TODAY,
      note: " Lost it ",
    });
  });

  it("each verdict has its toast", () => {
    expect(verdictToast("approved")).toBe(
      "Approved. Pick it when you create an objective.",
    );
    expect(verdictToast("parked")).toBe("Back in Parked.");
    expect(verdictToast("dropped")).toBe("Dropped. Both reasons are kept.");
  });
});

describe("dropping", () => {
  it("requires why, spaces alone are blank", () => {
    expect(checkDrop("")).toBe("Write why you're dropping it.");
    expect(checkDrop("   ")).toBe("Write why you're dropping it.");
    expect(checkDrop("x".repeat(DROP_WHY_MAX))).toBeNull();
  });
});

describe("the empty state", () => {
  it("has three steps", () => {
    expect(EMPTY.steps).toHaveLength(3);
  });
});

describe("the filter", () => {
  const ideas = [
    idea({ id: "l" }),
    idea({ id: "o", locked: false }),
    idea({ id: "a", verdict: "approved" }),
    idea({ id: "t", verdict: "taken" }),
    idea({ id: "d", verdict: "dropped" }),
  ];

  it("counts each verdict; Parked holds locked and open", () => {
    expect(filters(ideas).map((f) => [f.label, f.count])).toEqual([
      ["All", 5],
      ["Parked", 2],
      ["Approved", 1],
      ["Taken", 1],
      ["Dropped", 1],
    ]);
    expect(inFilter(ideas, "parked").map((i) => i.id)).toEqual(["l", "o"]);
    expect(inFilter(ideas, "all")).toHaveLength(5);
  });

  it("reads the address, All when it names none", () => {
    expect(filterOf("taken")).toBe("taken");
    expect(filterOf("nonsense")).toBe("all");
    expect(filterOf(undefined)).toBe("all");
    expect(emptyFilter("taken")).toBe("No taken ideas.");
  });
});
