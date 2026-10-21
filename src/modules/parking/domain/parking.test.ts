import { describe, expect, it } from "vitest";
import {
  assembleIdea,
  canTake,
  lockedUntil,
  validateIdeaWrite,
  validateVerdictWrite,
  verdictOn,
  verdictRefusal,
  type IdeaRow,
  type ObjectiveForLock,
} from "./parking";

const running = (
  start: string,
  end: string,
  events: ObjectiveForLock["statusEvents"] = [
    { occurred_on: start, change: "created" },
  ],
): ObjectiveForLock => ({
  segments: [{ start_date: start, end_date: end }],
  statusEvents: events,
});

describe("lockedUntil — docs/domain/parking-lock.md", () => {
  // The Parking lot design: one objective ending 21 Sep, a longer one ending
  // 2 Nov that started on 1 Sep.
  const short = running("2026-08-03", "2026-09-21");
  const long = running("2026-09-01", "2026-11-02");

  it("locks ideas caught on 28 and 31 August until 21 September", () => {
    expect(lockedUntil("2026-08-28", [short, long])).toBe("2026-09-21");
    expect(lockedUntil("2026-08-31", [short, long])).toBe("2026-09-21");
  });

  it("locks an idea caught on 14 September until 2 November — the latest end", () => {
    expect(lockedUntil("2026-09-14", [short, long])).toBe("2026-11-02");
  });

  it("does not lock an idea caught with nothing running", () => {
    expect(lockedUntil("2026-12-01", [short, long])).toBe("2026-12-01");
    expect(lockedUntil("2026-09-14", [])).toBe("2026-09-14");
  });

  it("ignores an objective paused on the day, or not yet started", () => {
    const paused = running("2026-08-03", "2026-12-31", [
      { occurred_on: "2026-08-03", change: "created" },
      { occurred_on: "2026-09-01", change: "paused" },
    ]);
    expect(lockedUntil("2026-09-14", [paused])).toBe("2026-09-14");
    const notYet = running("2026-10-01", "2026-12-31", [
      { occurred_on: "2026-09-01", change: "created" },
    ]);
    expect(lockedUntil("2026-09-14", [notYet])).toBe("2026-09-14");
  });

  it("uses the end as it stood that day, not a later extension", () => {
    const extended: ObjectiveForLock = {
      segments: [
        { start_date: "2026-08-03", end_date: "2026-09-21" },
        { start_date: "2026-09-22", end_date: "2026-10-31" },
      ],
      statusEvents: [{ occurred_on: "2026-08-03", change: "created" }],
    };
    expect(lockedUntil("2026-09-14", [extended])).toBe("2026-09-21");
    expect(lockedUntil("2026-09-25", [extended])).toBe("2026-10-31");
  });

  it("never ends before the idea was caught, for an objective past its end", () => {
    expect(lockedUntil("2026-09-25", [short])).toBe("2026-09-25");
  });
});

const row = (over: Partial<IdeaRow> = {}): IdeaRow => ({
  id: "i",
  idea: "Write a book",
  why: "Because.",
  caught_on: "2026-09-14",
  locked_until: "2026-11-02",
  verdicts: [{ verdict: "parked", note: null, occurred_on: "2026-09-14" }],
  notes: [],
  became_objective_id: null,
  ...over,
});

describe("assembleIdea", () => {
  it("is locked until locked_until, and opens that day", () => {
    expect(assembleIdea(row(), "2026-11-01")).toMatchObject({
      locked: true,
      verdict: "parked",
      decided_early: false,
    });
    expect(assembleIdea(row(), "2026-11-02").locked).toBe(false);
  });

  it("shows the latest verdict and its note", () => {
    const r = row({
      verdicts: [
        { verdict: "parked", note: null, occurred_on: "2026-09-14" },
        { verdict: "dropped", note: "Not now.", occurred_on: "2026-11-03" },
      ],
    });
    expect(assembleIdea(r, "2026-11-04")).toMatchObject({
      verdict: "dropped",
      note: "Not now.",
    });
  });

  it("moves between parked and approved, the latest row winning", () => {
    const r = row({
      verdicts: [
        { verdict: "parked", note: null, occurred_on: "2026-09-14" },
        { verdict: "approved", note: null, occurred_on: "2026-11-03" },
        { verdict: "parked", note: null, occurred_on: "2026-11-04" },
      ],
    });
    expect(assembleIdea(r, "2026-11-05").verdict).toBe("parked");
  });

  it("is decided early when approved, dropped or taken before the lock lifts", () => {
    for (const verdict of ["approved", "dropped", "taken"] as const) {
      const r = row({
        verdicts: [
          { verdict: "parked", note: null, occurred_on: "2026-09-14" },
          { verdict, note: "x", occurred_on: "2026-10-01" },
        ],
        became_objective_id: verdict === "taken" ? "o" : null,
      });
      expect(assembleIdea(r, "2026-10-02")).toMatchObject({
        verdict,
        decided_early: true,
      });
    }
  });

  it("is never early while parked, nor when decided the day the lock lifts", () => {
    expect(assembleIdea(row(), "2026-09-15").decided_early).toBe(false);
    const onTime = row({
      verdicts: [
        { verdict: "parked", note: null, occurred_on: "2026-09-14" },
        { verdict: "approved", note: null, occurred_on: "2026-11-02" },
      ],
    });
    expect(assembleIdea(onTime, "2026-11-02").decided_early).toBe(false);
  });

  it("keeps a final row current even when it is dated before the approval", () => {
    // Taken in one zone, approved in another: the dates can cross.
    const r = row({
      verdicts: [
        { verdict: "parked", note: null, occurred_on: "2026-09-14" },
        { verdict: "taken", note: null, occurred_on: "2026-11-02" },
        { verdict: "approved", note: null, occurred_on: "2026-11-03" },
      ],
      became_objective_id: "o",
    });
    expect(assembleIdea(r, "2026-11-06")).toMatchObject({
      verdict: "taken",
      decided_early: false,
    });
  });
});

describe("assembleIdea — verdict_on", () => {
  it("is the latest row's date, or the final row's when there is one", () => {
    expect(assembleIdea(row(), "2026-09-15").verdict_on).toBe("2026-09-14");
    const approved = row({
      verdicts: [
        { verdict: "parked", note: null, occurred_on: "2026-09-14" },
        { verdict: "approved", note: null, occurred_on: "2026-09-22" },
      ],
    });
    expect(assembleIdea(approved, "2026-09-23").verdict_on).toBe("2026-09-22");
    const taken = row({
      verdicts: [
        { verdict: "parked", note: null, occurred_on: "2026-09-14" },
        { verdict: "taken", note: null, occurred_on: "2026-08-31" },
        { verdict: "approved", note: null, occurred_on: "2026-09-01" },
      ],
    });
    expect(assembleIdea(taken, "2026-09-23").verdict_on).toBe("2026-08-31");
  });
});

describe("verdictOn", () => {
  const verdicts = [
    { verdict: "parked" as const, note: null, occurred_on: "2026-09-14" },
    { verdict: "dropped" as const, note: null, occurred_on: "2026-11-03" },
  ];
  it("is the verdict as it stood on a date", () => {
    expect(verdictOn(verdicts, "2026-09-13")).toBeNull();
    expect(verdictOn(verdicts, "2026-11-02")?.verdict).toBe("parked");
    expect(verdictOn(verdicts, "2026-11-03")?.verdict).toBe("dropped");
  });
});

describe("verdictRefusal", () => {
  const write = (
    verdict: "parked" | "approved" | "dropped",
    occurred_on = "2026-10-01",
    note: string | null = "Why.",
  ) => ({ verdict, occurred_on, note });

  it("takes any verdict on a locked idea — the lock records, it does not refuse", () => {
    expect(verdictRefusal(row(), write("approved"), "2026-10-01")).toBeNull();
    expect(verdictRefusal(row(), write("dropped"), "2026-10-01")).toBeNull();
    expect(verdictRefusal(row(), write("parked"), "2026-10-01")).toBeNull();
  });

  it("refuses anything after a drop or a take: both are final", () => {
    for (const verdict of ["dropped", "taken"] as const) {
      const r = row({
        verdicts: [
          { verdict: "parked", note: null, occurred_on: "2026-09-14" },
          { verdict, note: "x", occurred_on: "2026-11-05" },
        ],
      });
      expect(verdictRefusal(r, write("parked"), "2026-12-01")).toBe("final");
    }
  });

  it("refuses a drop that does not say why", () => {
    expect(
      verdictRefusal(row(), write("dropped", "2026-10-01", null), "2026-10-01"),
    ).toBe("needs_reason");
  });

  it("refuses a verdict dated after today", () => {
    expect(
      verdictRefusal(row(), write("approved", "2026-10-02"), "2026-10-01"),
    ).toBe("future");
  });
});

describe("validateIdeaWrite / validateVerdictWrite", () => {
  const fields = (r: { ok: boolean; error?: { field: string }[] }) =>
    r.ok ? [] : (r.error ?? []).map((e) => e.field);

  it("accepts an idea and names each bad field", () => {
    expect(
      validateIdeaWrite({ idea: "x", why: "y", caught_on: "2026-09-14" }),
    ).toEqual({
      ok: true,
      value: { idea: "x", why: "y", caught_on: "2026-09-14" },
    });
    expect(fields(validateIdeaWrite(null))).toEqual([
      "idea",
      "why",
      "caught_on",
    ]);
    expect(
      fields(
        validateIdeaWrite({ idea: "i".repeat(301), why: "", caught_on: "x" }),
      ),
    ).toEqual(["idea", "why", "caught_on"]);
    expect(fields(validateIdeaWrite([1]))).toEqual([
      "idea",
      "why",
      "caught_on",
    ]);
  });

  it("accepts parked, approved or dropped, never taken", () => {
    expect(
      validateVerdictWrite({ verdict: "approved", occurred_on: "2026-11-03" }),
    ).toEqual({
      ok: true,
      value: { verdict: "approved", occurred_on: "2026-11-03", note: null },
    });
    expect(
      validateVerdictWrite({
        verdict: "dropped",
        occurred_on: "2026-11-03",
        note: "Not now.",
      }),
    ).toEqual({
      ok: true,
      value: {
        verdict: "dropped",
        occurred_on: "2026-11-03",
        note: "Not now.",
      },
    });
    expect(
      validateVerdictWrite({
        verdict: "parked",
        occurred_on: "2026-11-03",
        note: "",
      }),
    ).toMatchObject({ ok: true, value: { note: null } });
    expect(
      validateVerdictWrite({
        verdict: "parked",
        occurred_on: "2026-11-03",
        note: null,
      }).ok,
    ).toBe(true);
    expect(
      fields(
        validateVerdictWrite({ verdict: "taken", occurred_on: "2026-11-03" }),
      ),
    ).toEqual(["verdict"]);
    expect(
      fields(
        validateVerdictWrite({
          verdict: "parked",
          occurred_on: "soon",
          note: 5,
        }),
      ),
    ).toEqual(["occurred_on", "note"]);
    expect(fields(validateVerdictWrite(null))).toEqual([
      "verdict",
      "occurred_on",
    ]);
    expect(fields(validateVerdictWrite("x"))).toEqual([
      "verdict",
      "occurred_on",
    ]);
  });
});

describe("canTake", () => {
  const approved = (on: string) =>
    row({
      verdicts: [
        { verdict: "parked", note: null, occurred_on: "2026-09-14" },
        { verdict: "approved", note: null, occurred_on: on },
      ],
    });

  it("takes an approved idea, locked or not", () => {
    expect(canTake(approved("2026-10-01"))).toBe(true); // before the lock lifts
    expect(canTake(approved("2026-11-05"))).toBe(true);
  });

  it("does not take a parked idea: it is approved first", () => {
    expect(canTake(row())).toBe(false);
  });

  it("does not take a dropped or taken idea: both are final", () => {
    for (const verdict of ["dropped", "taken"] as const) {
      expect(
        canTake(
          row({
            verdicts: [
              { verdict: "approved", note: null, occurred_on: "2026-09-20" },
              { verdict, note: "x", occurred_on: "2026-10-01" },
            ],
          }),
        ),
      ).toBe(false);
    }
  });
});
