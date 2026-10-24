import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import { getDayRows } from "@/modules/today/repo";
import { assembleDay } from "@/modules/today/domain/assembleDay";
import {
  addStatusEvents,
  testObjective,
  testUser,
  type TestUser,
} from "@/test/fixtures";

/**
 * W4-29 end to end: the Today read joins no `plan_slot`, and the covering slot
 * is computed from the segment and the status events against a real database.
 *
 * The unit tests pin the rule; this pins that the query actually returns the
 * facts the rule needs, in the shape it expects. Each case has its own user and
 * objective — fixed Mon–Fri, 2026-09-14 … 2026-10-11, created on the 14th — so
 * one case's pause or end cannot outrank the next one's.
 */
const WEDNESDAY = "2026-09-16";
const SATURDAY = "2026-09-19";

let USER_ID: string;
let OBJECTIVE_ID: string;

describe("Today computes its slot (real Postgres)", () => {
  beforeEach(async () => {
    const user: TestUser = await testUser();
    USER_ID = user.id;
    OBJECTIVE_ID = (await testObjective(user)).id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("has no plan_slot table to read — the slot can only be computed", async () => {
    // Until W4-30 this counted rows in an empty table. The table is gone now,
    // which is the stronger claim: there is nowhere for a stale slot to live.
    const res = await query<{ exists: boolean }>(
      "SELECT to_regclass('public.plan_slot') IS NOT NULL AS exists",
    );
    expect(res.rows[0].exists).toBe(false);
  });

  it("computes the day's slot, with no id, from segment and status events", async () => {
    const day = assembleDay(
      WEDNESDAY,
      await getDayRows(USER_ID, WEDNESDAY),
      null,
    );
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
    // The plan's end, so Today can tell a plan that has ended (G45).
    expect(objective?.end_date).toBe("2026-10-11");
  });

  it("has no slot on an off day", async () => {
    const day = assembleDay(
      SATURDAY,
      await getDayRows(USER_ID, SATURDAY),
      null,
    );
    expect(day.objectives.find((o) => o.id === OBJECTIVE_ID)?.slot).toBeNull();
  });

  it("stops planning while paused and plans again once resumed", async () => {
    await addStatusEvents(OBJECTIVE_ID, [
      ["2026-09-15", "paused"],
      ["2026-09-21", "resumed"],
    ]);

    const paused = assembleDay(
      WEDNESDAY,
      await getDayRows(USER_ID, WEDNESDAY),
      null,
    );
    expect(
      paused.objectives.find((o) => o.id === OBJECTIVE_ID)?.slot,
    ).toBeNull();

    const resumed = assembleDay(
      "2026-09-21",
      await getDayRows(USER_ID, "2026-09-21"),
      null,
    );
    expect(
      resumed.objectives.find((o) => o.id === OBJECTIVE_ID)?.slot?.period_start,
    ).toBe("2026-09-21");
  });

  it("drops an objective off Today once it is no longer active", async () => {
    await addStatusEvents(OBJECTIVE_ID, [["2026-09-15", "ended"]]);
    const day = assembleDay(
      WEDNESDAY,
      await getDayRows(USER_ID, WEDNESDAY),
      null,
    );
    expect(day.objectives.find((o) => o.id === OBJECTIVE_ID)).toBeUndefined();
  });
});
