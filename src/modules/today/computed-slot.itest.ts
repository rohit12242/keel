import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getConfig } from "@/config/env";
import { getPool, query } from "@/shared/db";
import { getDayRows } from "@/modules/today/repo";
import { assembleDay } from "@/modules/today/domain/assembleDay";

/**
 * W4-29 end to end: the Today read joins no `plan_slot`, and the covering slot
 * is computed from the segment and the status events against a real database.
 *
 * The unit tests pin the rule; this pins that the query actually returns the
 * facts the rule needs, in the shape it expects. Fixtures are `npm run seed`'s:
 * one objective, fixed Mon–Fri, 2026-09-14 … 2026-10-11, created on the 14th.
 */
const USER_ID = getConfig().seedUserId;
const OBJECTIVE_ID = "00000000-0000-0000-0000-0000000000a1";
const WEDNESDAY = "2026-09-16";
const SATURDAY = "2026-09-19";

/** Status events added by a test, removed afterwards (the seed's stays). */
async function clearAddedEvents(): Promise<void> {
  await query(
    "DELETE FROM status_event WHERE objective_id = $1 AND change <> 'created'",
    [OBJECTIVE_ID],
  );
}

describe("Today computes its slot (real Postgres)", () => {
  // Each case starts from the seed's single 'created' event, so one test's
  // pause or end cannot outrank the next one's.
  beforeEach(clearAddedEvents);

  afterAll(async () => {
    await clearAddedEvents();
    await getPool().end();
  });

  it("reads no plan_slot rows — there are none to read", async () => {
    const res = await query<{ count: string }>(
      "SELECT count(*) FROM plan_slot",
    );
    expect(Number(res.rows[0].count)).toBe(0);
  });

  it("computes the day's slot, with no id, from segment and status events", async () => {
    const day = assembleDay(WEDNESDAY, await getDayRows(USER_ID, WEDNESDAY));
    const objective = day.objectives.find((o) => o.id === OBJECTIVE_ID);
    expect(objective?.slot).toEqual({
      period_kind: "day",
      period_start: WEDNESDAY,
      period_end: WEDNESDAY,
      target_minutes: 120,
      target_days: null,
    });
    expect(objective?.slot && "id" in objective.slot).toBe(false);
    expect(objective?.next_planned_date).toBe("2026-09-17");
  });

  it("has no slot on an off day", async () => {
    const day = assembleDay(SATURDAY, await getDayRows(USER_ID, SATURDAY));
    expect(day.objectives.find((o) => o.id === OBJECTIVE_ID)?.slot).toBeNull();
  });

  it("stops planning while paused and plans again once resumed", async () => {
    await query(
      `INSERT INTO status_event (objective_id, occurred_on, change)
       VALUES ($1, '2026-09-15', 'paused'), ($1, '2026-09-21', 'resumed')`,
      [OBJECTIVE_ID],
    );

    const paused = assembleDay(WEDNESDAY, await getDayRows(USER_ID, WEDNESDAY));
    expect(
      paused.objectives.find((o) => o.id === OBJECTIVE_ID)?.slot,
    ).toBeNull();

    const resumed = assembleDay(
      "2026-09-21",
      await getDayRows(USER_ID, "2026-09-21"),
    );
    expect(
      resumed.objectives.find((o) => o.id === OBJECTIVE_ID)?.slot?.period_start,
    ).toBe("2026-09-21");
  });

  it("drops an objective off Today once it is no longer active", async () => {
    await query(
      `INSERT INTO status_event (objective_id, occurred_on, change)
       VALUES ($1, '2026-09-15', 'ended')`,
      [OBJECTIVE_ID],
    );
    const day = assembleDay(WEDNESDAY, await getDayRows(USER_ID, WEDNESDAY));
    expect(day.objectives.find((o) => o.id === OBJECTIVE_ID)).toBeUndefined();
  });
});
