import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import { createEffortEntry } from "./service";

/**
 * W4-29: the effort write now reads facts (segments, status events) and applies
 * the rules in `domain/` — the status is the latest event, and `extra` is
 * "no computed slot covers this date". This drives the service end to end so
 * those rules, and every failure path, are exercised rather than declared
 * (NFR-07, DoD clause 8).
 *
 * Fixtures are `npm run seed`'s: one objective, fixed Mon–Fri,
 * 2026-09-14 … 2026-10-11, created on the 14th.
 */
const OBJECTIVE_ID = "00000000-0000-0000-0000-0000000000a1";
const WEDNESDAY = "2026-09-16"; // planned
const SATURDAY = "2026-09-19"; // inside the range, not a planned weekday
const NOTE = "itest: W4-29 effort write";

function body(over: Record<string, unknown> = {}) {
  return {
    local_date: WEDNESDAY,
    tz: "Asia/Kolkata",
    minutes: 60,
    note: NOTE,
    ...over,
  };
}

async function cleanup(): Promise<void> {
  await query("DELETE FROM effort_entry WHERE note = $1", [NOTE]);
  await query(
    "DELETE FROM status_event WHERE objective_id = $1 AND change <> 'created'",
    [OBJECTIVE_ID],
  );
}

describe("createEffortEntry (real Postgres)", () => {
  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await getPool().end();
  });

  // --- failure paths --------------------------------------------------------

  it("refuses a body that is not valid (400)", async () => {
    const result = await createEffortEntry(OBJECTIVE_ID, body({ minutes: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "validation") {
      expect(result.errors.map((e) => e.field)).toContain("minutes");
    } else {
      expect.unreachable("expected a validation failure");
    }
  });

  it("is not_found for an objective that is not this user's (404, NFR-10)", async () => {
    const result = await createEffortEntry(
      "00000000-0000-0000-0000-00000000dead",
      body(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("not_found");
  });

  it("is not_active once the objective has ended — read from the events, not a column", async () => {
    await query(
      `INSERT INTO status_event (objective_id, occurred_on, change)
       VALUES ($1, '2026-09-15', 'ended')`,
      [OBJECTIVE_ID],
    );
    const result = await createEffortEntry(OBJECTIVE_ID, body());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("not_active");
  });

  it("is outside_plan for a date beyond every segment", async () => {
    const result = await createEffortEntry(
      OBJECTIVE_ID,
      body({ local_date: "2026-11-02" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("outside_plan");
  });

  // --- what it writes -------------------------------------------------------

  it("logs a planned day as not extra", async () => {
    const result = await createEffortEntry(OBJECTIVE_ID, body());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.extra).toBe(false);
      expect(result.entry.local_date).toBe(WEDNESDAY);
    }
  });

  it("logs an off day inside the plan as extra", async () => {
    const result = await createEffortEntry(
      OBJECTIVE_ID,
      body({ local_date: SATURDAY }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.entry.extra).toBe(true);
  });

  it("counts effort logged during a paused stretch as extra (invariant 10)", async () => {
    // Paused before the planned day, resumed after it: the objective is active
    // now, so the write is allowed, but that day was not planned.
    await query(
      `INSERT INTO status_event (objective_id, occurred_on, change)
       VALUES ($1, '2026-09-15', 'paused'), ($1, '2026-09-21', 'resumed')`,
      [OBJECTIVE_ID],
    );
    const result = await createEffortEntry(OBJECTIVE_ID, body());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.entry.extra).toBe(true);
  });
});
