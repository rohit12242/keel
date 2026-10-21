import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import {
  addStatusEvents,
  testObjective,
  testUser,
  type TestUser,
} from "@/test/fixtures";
import { createEffortEntry } from "./service";

/**
 * W4-29: the effort write now reads facts (segments, status events) and applies
 * the rules in `domain/` — the status is the latest event, and `extra` is
 * "no computed slot covers this date". This drives the service end to end so
 * those rules, and every failure path, are exercised rather than declared
 * (NFR-07, DoD clause 8).
 *
 * Each case has its own user and objective, fixed Mon–Fri,
 * 2026-09-14 … 2026-10-11, created on the 14th.
 */
const WEDNESDAY = "2026-09-16"; // planned
const SATURDAY = "2026-09-19"; // inside the range, not a planned weekday
const NOTE = "itest: W4-29 effort write";

function body(over: Record<string, unknown> = {}) {
  return {
    local_date: WEDNESDAY,
    tz: "Asia/Kolkata",
    occurred_at_local: "09:20",
    minutes: 60,
    note: NOTE,
    ...over,
  };
}

let user: TestUser;
let OBJECTIVE_ID: string;

/** Log as the case's own user. */
const log = (objectiveId: string, b: unknown) =>
  createEffortEntry(user.id, objectiveId, b);

describe("createEffortEntry (real Postgres)", () => {
  beforeEach(async () => {
    user = await testUser();
    OBJECTIVE_ID = (await testObjective(user)).id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  // --- failure paths --------------------------------------------------------

  it("refuses a body that is not valid (400)", async () => {
    const result = await log(OBJECTIVE_ID, body({ minutes: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "validation") {
      expect(result.errors.map((e) => e.field)).toContain("minutes");
    } else {
      expect.unreachable("expected a validation failure");
    }
  });

  it("is not_found for an objective that does not exist (404)", async () => {
    const result = await log("00000000-0000-0000-0000-00000000dead", body());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("not_found");
  });

  it("is not_found for another user's objective, and writes nothing (404, NFR-10)", async () => {
    const someoneElse = await testUser();
    const theirs = await testObjective(someoneElse);
    const result = await log(theirs.id, body());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("not_found");
    const written = await query(
      "SELECT 1 FROM effort_entry WHERE objective_id = $1",
      [theirs.id],
    );
    expect(written.rowCount).toBe(0);
  });

  it("is not_active once the objective has ended — read from the events, not a column", async () => {
    await addStatusEvents(OBJECTIVE_ID, [["2026-09-15", "ended"]]);
    const result = await log(OBJECTIVE_ID, body());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("not_active");
  });

  it("is outside_plan for a date beyond every segment", async () => {
    const result = await log(OBJECTIVE_ID, body({ local_date: "2026-11-02" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("outside_plan");
  });

  it("is overlap for an entry that overlaps another of the user's that day, under any objective — and writes nothing", async () => {
    const other = (await testObjective(user)).id;
    expect((await log(other, body())).ok).toBe(true); // 09:20–10:20
    const result = await log(
      OBJECTIVE_ID,
      body({ occurred_at_local: "10:00", note: "overlap probe" }),
    );
    expect(result).toMatchObject({ ok: false, kind: "overlap" });
    if (!result.ok && result.kind === "overlap") {
      expect(result.detail).toContain("09:20–10:20");
    }
    const written = await query(
      "SELECT 1 FROM effort_entry WHERE note = 'overlap probe' AND objective_id = $1",
      [OBJECTIVE_ID],
    );
    expect(written.rowCount).toBe(0);
  });

  it("allows an entry that only touches another, or overlaps another user's", async () => {
    expect((await log(OBJECTIVE_ID, body())).ok).toBe(true); // 09:20–10:20
    expect(
      (await log(OBJECTIVE_ID, body({ occurred_at_local: "10:20" }))).ok,
    ).toBe(true);
    const someoneElse = await testUser();
    const theirs = (await testObjective(someoneElse)).id;
    const theirLog = await createEffortEntry(someoneElse.id, theirs, body());
    expect(theirLog.ok).toBe(true);
  });

  // --- what it writes -------------------------------------------------------

  it("logs a planned day as not extra", async () => {
    const result = await log(OBJECTIVE_ID, body());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.extra).toBe(false);
      expect(result.entry.local_date).toBe(WEDNESDAY);
    }
  });

  it("logs an off day inside the plan as extra", async () => {
    const result = await log(OBJECTIVE_ID, body({ local_date: SATURDAY }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.entry.extra).toBe(true);
  });

  it("counts effort logged during a paused stretch as extra (invariant 10)", async () => {
    // Paused before the planned day, resumed after it: the objective is active
    // now, so the write is allowed, but that day was not planned.
    await addStatusEvents(OBJECTIVE_ID, [
      ["2026-09-15", "paused"],
      ["2026-09-21", "resumed"],
    ]);
    const result = await log(OBJECTIVE_ID, body());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.entry.extra).toBe(true);
  });
});
