import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import type { ObjectiveSummary } from "@/shared/contract";
import * as one from "@/app/v1/objectives/[objectiveId]/route";
import * as list from "@/app/v1/objectives/route";
import { testObjective, testUser, type TestUser } from "@/test/fixtures";

/**
 * I-02 step 22 — next_review_on and reviews_due on every objective read,
 * against a plan wholly in the past: fixed Mon–Fri, Mon 2026-09-14 … Sun
 * 2026-10-11, reviewed weekly — Week 1, 2 and 3, then End of plan.
 */
let me: TestUser;
let objectiveId: string;

const read = async (): Promise<ObjectiveSummary> => {
  const res = await one.GET(
    new Request(`http://keel.test/v1/objectives/${objectiveId}`, {
      headers: { cookie: me.cookie },
    }),
    { params: Promise.resolve({ objectiveId }) },
  );
  return (await res.json()) as ObjectiveSummary;
};

describe("reviews due (real Postgres)", () => {
  beforeAll(async () => {
    me = await testUser();
    objectiveId = (await testObjective(me)).id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("owes every closed window, the earliest first", async () => {
    expect(await read()).toMatchObject({
      next_review_on: "2026-09-20",
      reviews_due: 4,
    });
  });

  it("stops owing a window once its review is saved — a draft does not count", async () => {
    await query(
      `INSERT INTO review (objective_id, kind, period_start, period_end, status, saved_at)
       VALUES ($1, 'weekly', '2026-09-14', '2026-09-20', 'saved', now()),
              ($1, 'weekly', '2026-09-21', '2026-09-27', 'draft', NULL)`,
      [objectiveId],
    );
    expect(await read()).toMatchObject({
      next_review_on: "2026-09-27",
      reviews_due: 3,
    });
    const listed = (await (
      await list.GET(
        new Request("http://keel.test/v1/objectives", {
          headers: { cookie: me.cookie },
        }),
        undefined,
      )
    ).json()) as { objectives: ObjectiveSummary[] };
    expect(listed.objectives[0]).toMatchObject({
      next_review_on: "2026-09-27",
      reviews_due: 3,
    });
  });
});
