import { describe, expect, it } from "vitest";
import type { SegmentForSlots } from "@/modules/objectives/domain/generateSlots";
import {
  costByKind,
  deviationRefusal,
  validateDeviationWrite,
  type DeviationWrite,
  type ObjectiveFacts,
} from "./deviationWrite";

const A = "0b6f3c1e-7d1a-4c55-9a51-6f0c2a8e9b11";
const B = "1b6f3c1e-7d1a-4c55-9a51-6f0c2a8e9b11";
const P = "2b6f3c1e-7d1a-4c55-9a51-6f0c2a8e9b11";

const body = (over: Record<string, unknown> = {}) => ({
  objective_ids: [A],
  local_date: "2026-09-16",
  tz: "Asia/Kolkata",
  kind: "chosen",
  what_happened: "Helped a friend move.",
  reasoning: "They asked; it mattered more today.",
  minutes: 90,
  ...over,
});

const fields = (r: ReturnType<typeof validateDeviationWrite>) =>
  r.ok ? [] : r.error.map((e) => e.field);

describe("validateDeviationWrite", () => {
  it("accepts the contract's shape, a one-off with no pattern", () => {
    expect(validateDeviationWrite(body())).toEqual({
      ok: true,
      value: { ...body(), did_instead: null, pattern_id: null },
    });
  });

  it("keeps did_instead and a pattern when given", () => {
    const r = validateDeviationWrite(
      body({
        did_instead: "Packed boxes.",
        pattern_id: P,
        objective_ids: [A, B],
      }),
    );
    expect(r).toMatchObject({
      ok: true,
      value: {
        did_instead: "Packed boxes.",
        pattern_id: P,
        objective_ids: [A, B],
      },
    });
    expect(validateDeviationWrite(body({ did_instead: "" }))).toMatchObject({
      ok: true,
      value: { did_instead: null },
    });
    expect(validateDeviationWrite(body({ pattern_id: null })).ok).toBe(true);
  });

  it.each([
    [{ objective_ids: [] }, "objective_ids"],
    [{ objective_ids: "x" }, "objective_ids"],
    [{ objective_ids: ["nope"] }, "objective_ids"],
    [{ objective_ids: [A, A.toUpperCase()] }, "objective_ids"],
    [{ local_date: "16-09-2026" }, "local_date"],
    [{ tz: "Mars/Olympus" }, "tz"],
    [{ tz: 5 }, "tz"],
    [{ kind: "neither" }, "kind"],
    [{ what_happened: "" }, "what_happened"],
    [{ reasoning: "r".repeat(2001) }, "reasoning"],
    [{ did_instead: 3 }, "did_instead"],
    [{ minutes: 0 }, "minutes"],
    [{ minutes: 1441 }, "minutes"],
    [{ minutes: 1.5 }, "minutes"],
    [{ pattern_id: "nope" }, "pattern_id"],
  ])("refuses %j", (over, field) => {
    expect(fields(validateDeviationWrite(body(over)))).toEqual([field]);
  });

  it("refuses a body that is not an object, naming every required field", () => {
    expect(fields(validateDeviationWrite(null))).toEqual([
      "objective_ids",
      "local_date",
      "tz",
      "kind",
      "what_happened",
      "reasoning",
      "minutes",
    ]);
    expect(validateDeviationWrite([1]).ok).toBe(false);
  });
});

describe("deviationRefusal", () => {
  const segment: SegmentForSlots = {
    scheduleMode: "fixed",
    plannedWeekdays: [1, 2, 3, 4, 5],
    minutesPerPlannedDay: 60,
    startDate: "2026-09-14",
    endDate: "2026-10-11",
  };
  const active: ObjectiveFacts = {
    segments: [segment],
    statusEvents: [{ occurred_on: "2026-09-14", change: "created" }],
  };
  const write = (over: Partial<DeviationWrite> = {}): DeviationWrite => ({
    ...(validateDeviationWrite(body()) as { ok: true; value: DeviationWrite })
      .value,
    ...over,
  });
  const refuse = (
    w: DeviationWrite,
    objectives: [string, ObjectiveFacts][] = [[A, active]],
    patternIsTheirs = true,
    today = "2026-09-20",
  ) =>
    deviationRefusal({
      write: w,
      objectives: new Map(objectives),
      patternIsTheirs,
      today,
    });

  it("allows a deviation on a planned or off day inside an active plan, up to today", () => {
    expect(refuse(write())).toBeNull();
    expect(refuse(write({ local_date: "2026-09-19" }))).toBeNull(); // Saturday
    expect(refuse(write({ local_date: "2026-09-20" }))).toBeNull(); // today
  });

  it("refuses a date after today in the caller's zone", () => {
    expect(refuse(write({ local_date: "2026-09-21" }))).toMatch(/after today/);
  });

  it("refuses an objective that is not the caller's", () => {
    expect(refuse(write({ objective_ids: [A, B] }))).toMatch(
      /not one of yours/,
    );
  });

  it("refuses an objective that is not active", () => {
    const ended: ObjectiveFacts = {
      ...active,
      statusEvents: [
        ...active.statusEvents,
        { occurred_on: "2026-09-18", change: "ended" },
      ],
    };
    expect(refuse(write(), [[A, ended]])).toMatch(/not active/);
  });

  it("refuses a date outside the objective's plan", () => {
    expect(refuse(write({ local_date: "2026-09-13" }))).toMatch(
      /no plan covering/,
    );
  });

  it("refuses a pattern that is not the caller's, and allows a one-off", () => {
    expect(refuse(write({ pattern_id: P }), [[A, active]], false)).toMatch(
      /pattern/,
    );
    expect(
      refuse(write({ pattern_id: null }), [[A, active]], false),
    ).toBeNull();
  });
});

describe("costByKind", () => {
  it("counts and sums each kind, and is zero for none", () => {
    expect(
      costByKind([
        { kind: "chosen", minutes: 30 },
        { kind: "drifted", minutes: 45 },
        { kind: "chosen", minutes: 15 },
      ]),
    ).toEqual({
      chosen: { count: 2, minutes: 45 },
      drifted: { count: 1, minutes: 45 },
    });
    expect(costByKind([])).toEqual({
      chosen: { count: 0, minutes: 0 },
      drifted: { count: 0, minutes: 0 },
    });
  });
});
