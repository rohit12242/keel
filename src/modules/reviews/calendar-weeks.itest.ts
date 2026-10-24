import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool } from "@/shared/db";
import type { Objective } from "@/shared/contract";
import * as one from "@/app/v1/objectives/[objectiveId]/route";
import * as reviewsOf from "@/app/v1/objectives/[objectiveId]/reviews/route";
import { testObjective, testUser, type TestUser } from "@/test/fixtures";

/**
 * I-09 — the intent's check, against plans wholly in the past: started on a
 * Thursday or a Monday, weekly reviews end on Sundays and the plan weeks are
 * the same days; started on the 10th, monthly reviews end on month ends.
 */
let me: TestUser;

const params = (objectiveId: string) => ({
  params: Promise.resolve({ objectiveId }),
});

const objective = async (id: string): Promise<Objective> =>
  (await (
    await one.GET(
      new Request(`http://keel.test/v1/objectives/${id}`, {
        headers: { cookie: me.cookie },
      }),
      params(id),
    )
  ).json()) as Objective;

const due = async (id: string) =>
  (
    (await (
      await reviewsOf.GET(
        new Request(`http://keel.test/v1/objectives/${id}/reviews`, {
          headers: { cookie: me.cookie },
        }),
        params(id),
      )
    ).json()) as {
      due: { label: string; period_start: string; period_end: string }[];
    }
  ).due.map((w) => `${w.label} ${w.period_start}…${w.period_end}`);

describe("calendar weeks and months (real Postgres)", () => {
  beforeAll(async () => {
    me = await testUser();
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("a Thursday start: weeks end on Sundays, a 3-day tail joins the last week", async () => {
    const id = (await testObjective(me, { starts_on: "2026-09-17" })).id;
    const windows = [
      "Week 1 2026-09-17…2026-09-20",
      "Week 2 2026-09-21…2026-09-27",
      "Week 3 2026-09-28…2026-10-04",
      "End of plan 2026-10-05…2026-10-14",
    ];
    expect(await due(id)).toEqual(windows);
    const weeks = (await objective(id)).weeks.map(
      (w) => `${w.period_start}…${w.period_end}`,
    );
    expect(weeks).toEqual(windows.map((w) => w.split(" ").at(-1)));
  });

  it("a Monday start lines up with the same Monday-to-Sunday weeks", async () => {
    const id = (await testObjective(me, { starts_on: "2026-09-21" })).id;
    expect(await due(id)).toEqual([
      "Week 1 2026-09-21…2026-09-27",
      "Week 2 2026-09-28…2026-10-04",
      "Week 3 2026-10-05…2026-10-11",
      "End of plan 2026-10-12…2026-10-18",
    ]);
  });

  it("monthly from the 10th: reviews on month ends, a 9-day last month joined", async () => {
    const id = (
      await testObjective(me, {
        starts_on: "2026-06-10",
        runs_for_days: 92, // to Wed 9 Sep
        review_cadence: "monthly",
      })
    ).id;
    expect(await due(id)).toEqual([
      "Month 1 2026-06-10…2026-06-30",
      "Month 2 2026-07-01…2026-07-31",
      "End of plan 2026-08-01…2026-09-09",
    ]);
  });
});
