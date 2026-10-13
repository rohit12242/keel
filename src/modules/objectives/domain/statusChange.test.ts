import { describe, expect, it } from "vitest";
import type { StatusEventRow } from "./statusTimeline";
import {
  statusChange,
  validateStatusChange,
  type ChangeRequest,
} from "./statusChange";

const ev = (occurred_on: string, change: StatusEventRow["change"]) => ({
  occurred_on,
  change,
});
const ACTIVE = [ev("2026-09-14", "created")];
const PAUSED = [...ACTIVE, ev("2026-09-20", "paused")];
const COMPLETED = [...ACTIVE, ev("2026-09-20", "completed")];
const ENDED = [...ACTIVE, ev("2026-09-20", "ended")];

const ask = (change: ChangeRequest, occurred_on = "2026-09-25") => ({
  change,
  occurred_on,
  reason: null,
});

describe("statusChange — the transition table", () => {
  it.each([
    [ACTIVE, "pause", "paused"],
    [ACTIVE, "complete", "completed"],
    [ACTIVE, "end", "ended"],
    [PAUSED, "resume", "resumed"],
    [PAUSED, "complete", "completed"],
    [PAUSED, "end", "ended"],
  ] as const)("allows %#: %s", (events, change, event) => {
    expect(statusChange(events, ask(change))).toEqual({
      ok: true,
      value: event,
    });
  });

  it.each([
    [ACTIVE, "resume", "active"],
    [PAUSED, "pause", "paused"],
    [COMPLETED, "pause", "completed"],
    [COMPLETED, "resume", "completed"],
    [COMPLETED, "complete", "completed"],
    [COMPLETED, "end", "completed"],
    [ENDED, "end", "ended"],
    [ENDED, "resume", "ended"],
  ] as const)("refuses %#: %s — it does not follow", (events, change, from) => {
    expect(statusChange(events, ask(change))).toEqual({
      ok: false,
      error: { kind: "does_not_follow", from },
    });
  });

  it("refuses anything for an objective with no history at all", () => {
    expect(statusChange([], ask("pause"))).toEqual({
      ok: false,
      error: { kind: "does_not_follow", from: null },
    });
  });

  it("refuses a date before the latest event, and allows the same day", () => {
    expect(statusChange(PAUSED, ask("resume", "2026-09-19"))).toEqual({
      ok: false,
      error: { kind: "before_latest", latest: "2026-09-20" },
    });
    expect(statusChange(PAUSED, ask("resume", "2026-09-20")).ok).toBe(true);
  });
});

describe("validateStatusChange", () => {
  it("accepts a change with and without a reason", () => {
    expect(
      validateStatusChange({ change: "pause", occurred_on: "2026-09-25" }),
    ).toEqual({
      ok: true,
      value: { change: "pause", occurred_on: "2026-09-25", reason: null },
    });
    expect(
      validateStatusChange({
        change: "end",
        occurred_on: "2026-09-25",
        reason: "Done with it.",
      }),
    ).toMatchObject({ ok: true, value: { reason: "Done with it." } });
    expect(
      validateStatusChange({
        change: "end",
        occurred_on: "2026-09-25",
        reason: null,
      }),
    ).toMatchObject({ ok: true, value: { reason: null } });
  });

  it("names every bad field", () => {
    const r = validateStatusChange({
      change: "paused",
      occurred_on: "25-09-2026",
      reason: "r".repeat(2001),
    });
    expect(r.ok ? [] : r.error.map((e) => e.field)).toEqual([
      "change",
      "occurred_on",
      "reason",
    ]);
  });

  it("refuses a body that is not an object, and an inherited name as a change", () => {
    for (const bad of [null, [1], "pause"]) {
      expect(validateStatusChange(bad).ok).toBe(false);
    }
    expect(
      validateStatusChange({ change: "toString", occurred_on: "2026-09-25" })
        .ok,
    ).toBe(false);
    expect(
      validateStatusChange({
        change: "pause",
        occurred_on: "2026-09-25",
        reason: 3,
      }).ok,
    ).toBe(false);
  });
});
