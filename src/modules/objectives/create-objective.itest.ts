import { afterAll, describe, expect, it } from "vitest";
import { getConfig } from "@/config/env";
import { getPool, query, withTransaction, type Queryable } from "@/shared/db";
import { insertObjective } from "./repo";
import { createObjective } from "./service";
import { validateObjectiveWrite } from "./domain/validateObjectiveWrite";

/**
 * I-01 step 6: the create is one transaction. The objective, segment 0 and
 * its `created` event land together or not at all — an objective without its
 * created event has no status, and every later read of the list would fail on
 * it (ERD invariant 16).
 *
 * Nothing here is deleted (NFR-01) and the suite runs once per timezone
 * against one database, so every assertion filters by the ids this test made.
 */
const BODY = {
  title: "itest: I-01 create",
  why_now: "Proving the create is all or nothing.",
  success_criteria: "Three rows, or none.",
  schedule: {
    mode: "fixed",
    planned_weekdays: [1, 3, 5],
    minutes_per_planned_day: 60,
  },
  starts_on: "2026-11-02",
  tz: "Asia/Kolkata",
  runs_for_days: 14,
  review_cadence: "weekly",
};

async function countRows(objectiveId: string) {
  const res = await query<{ segments: string; events: string }>(
    `SELECT
       (SELECT count(*) FROM plan_segment WHERE objective_id = $1) AS segments,
       (SELECT count(*) FROM status_event
         WHERE objective_id = $1 AND change = 'created') AS events`,
    [objectiveId],
  );
  return {
    segments: Number(res.rows[0].segments),
    events: Number(res.rows[0].events),
  };
}

describe("createObjective (real Postgres)", () => {
  afterAll(async () => {
    await getPool().end();
  });

  it("writes the objective, segment 0 and its created event together", async () => {
    const result = await createObjective(BODY);
    if (!result.ok) throw new Error(`create failed: ${result.kind}`);
    const o = result.objective;

    expect(await countRows(o.id)).toEqual({ segments: 1, events: 1 });
    expect(o).toMatchObject({
      status: "active",
      start_date: "2026-11-02",
      end_date: "2026-11-15",
      extension_count: 0,
    });
    // Segment 0's reason is why_now, and the event is dated starts_on.
    expect(o.segments[0].reason).toBe(BODY.why_now);
    expect(o.status_history).toEqual([
      { occurred_on: "2026-11-02", change: "created", reason: null },
    ]);
  });

  it("leaves nothing behind when the third write fails", async () => {
    const validated = validateObjectiveWrite({
      ...BODY,
      title: `itest: I-01 rollback ${Date.now()}`,
    });
    if (!validated.ok) throw new Error("fixture is invalid");

    let objectiveId: string | null = null;
    await expect(
      withTransaction(async (tx) => {
        // A client whose status_event insert fails, after the other two ran.
        const failing: Queryable = {
          query: async (text, params) => {
            if (text.includes("INSERT INTO status_event")) {
              throw new Error("forced: the created event did not write");
            }
            const res = await tx.query(text, params);
            if (text.includes("INSERT INTO objective")) {
              objectiveId = (res.rows[0] as { id: string }).id;
            }
            return res as never;
          },
        };
        return insertObjective(
          failing,
          getConfig().seedUserId,
          validated.value,
        );
      }),
    ).rejects.toThrow(/forced/);

    expect(objectiveId).not.toBeNull();
    const left = await query("SELECT 1 FROM objective WHERE id = $1", [
      objectiveId,
    ]);
    expect(left.rowCount).toBe(0);
    expect(await countRows(objectiveId as unknown as string)).toEqual({
      segments: 0,
      events: 0,
    });
  });

  it("writes nothing for a refused body", async () => {
    const title = `itest: I-01 refused ${Date.now()}`;
    const result = await createObjective({
      ...BODY,
      title,
      schedule: { ...BODY.schedule, days_per_week: 3 },
    });
    expect(result).toMatchObject({ ok: false, kind: "mode_mismatch" });
    const res = await query("SELECT 1 FROM objective WHERE title = $1", [
      title,
    ]);
    expect(res.rowCount).toBe(0);
  });
});
