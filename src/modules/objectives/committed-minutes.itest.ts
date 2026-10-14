import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool } from "@/shared/db";
import * as list from "@/app/v1/objectives/route";
import {
  addStatusEvents,
  testObjective,
  testUser,
  type TestUser,
} from "@/test/fixtures";

/**
 * I-02 step 12 — `committed_minutes_per_week` on the list. It is read against
 * today, so these objectives are dated around the real today rather than at
 * fixed dates: each starts a week ago and runs for sixty days.
 */
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const weekAgo = iso(Date.now() - 7 * DAY);

let me: TestUser;

const get = (qs = "") =>
  list.GET(
    new Request(`http://keel.test/v1/objectives${qs}`, {
      headers: { cookie: me.cookie },
    }),
    undefined,
  );

describe("committed minutes per week (real Postgres)", () => {
  beforeAll(async () => {
    me = await testUser("UTC");
    const common = { starts_on: weekAgo, runs_for_days: 60, tz: "UTC" };
    await testObjective(me, {
      ...common,
      schedule: {
        mode: "fixed",
        planned_weekdays: [1, 2, 3, 4, 5],
        minutes_per_planned_day: 60,
      },
    });
    await testObjective(me, {
      ...common,
      schedule: {
        mode: "flexible",
        days_per_week: 2,
        minutes_per_planned_day: 30,
      },
    });
    const paused = await testObjective(me, common);
    await addStatusEvents(paused.id, [[weekAgo, "paused"]]);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("sums the active objectives' weekly commitment, and nothing for the paused one", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      objectives: unknown[];
      committed_minutes_per_week: number;
    };
    expect(body.objectives).toHaveLength(3);
    expect(body.committed_minutes_per_week).toBe(5 * 60 + 2 * 30);
  });

  it("does not change with the filter", async () => {
    const body = (await (await get("?status=paused")).json()) as {
      objectives: unknown[];
      committed_minutes_per_week: number;
    };
    expect(body.objectives).toHaveLength(1);
    expect(body.committed_minutes_per_week).toBe(360);
  });

  it("is zero for someone with no objectives", async () => {
    me = await testUser();
    expect(await (await get()).json()).toEqual({
      objectives: [],
      committed_minutes_per_week: 0,
    });
  });
});
