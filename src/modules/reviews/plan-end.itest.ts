import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool } from "@/shared/db";
import type { Objective } from "@/shared/contract";
import * as one from "@/app/v1/objectives/[objectiveId]/route";
import {
  testObjective,
  testReview,
  testUser,
  type TestUser,
} from "@/test/fixtures";
import { saveReview, updateReview } from "./service";

/**
 * I-02 step 27 — saving a plan-end review applies its outcome (invariant 7).
 * The objective runs Mon 2026-09-14 … Sun 2026-10-11, weekly: Week 1 … 3 are
 * saved first, so End of plan (2026-10-05 … 2026-10-11) is the one due.
 */
let me: TestUser;
let objectiveId: string;

const objective = async (): Promise<Objective> =>
  (await (
    await one.GET(
      new Request(`http://keel.test/v1/objectives/${objectiveId}`, {
        headers: { cookie: me.cookie },
      }),
      { params: Promise.resolve({ objectiveId }) },
    )
  ).json()) as Objective;

async function planEndDraft(): Promise<string> {
  for (let week = 1; week <= 3; week++) {
    const r = await testReview(me, objectiveId);
    const saved = await saveReview(me.id, r.id, new Date());
    if (!saved.ok) throw new Error(`week ${week}: ${JSON.stringify(saved)}`);
  }
  const planEnd = await testReview(me, objectiveId);
  return planEnd.id;
}

describe("saving a plan-end review (real Postgres)", () => {
  beforeEach(async () => {
    me = await testUser();
    objectiveId = (await testObjective(me)).id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("refuses to save without an outcome and a criteria verdict", async () => {
    const id = await planEndDraft();
    expect(await saveReview(me.id, id, new Date())).toMatchObject({
      ok: false,
      kind: "refused",
    });
  });

  it("completes the objective, dated the plan's last day, and shows the verdict", async () => {
    const id = await planEndDraft();
    await updateReview(
      me.id,
      id,
      {
        outcome: "completed",
        criteria_verdict: "partly_met",
        criteria_assessment: "Two of three.",
      },
      new Date(),
    );
    const saved = await saveReview(me.id, id, new Date());
    expect(saved).toMatchObject({
      ok: true,
      review: {
        kind: "plan_end",
        label: "End of plan",
        status: "saved",
        outcome: "completed",
      },
    });
    const o = await objective();
    expect(o.status).toBe("completed");
    expect(o.status_history.at(-1)).toEqual({
      occurred_on: "2026-10-11",
      change: "completed",
      reason: null,
    });
    expect(o.criteria_verdict).toBe("partly_met");
    expect(o.reviews_due).toBe(0);
  });

  it("writes no status event for continued — the objective stays active", async () => {
    const id = await planEndDraft();
    await updateReview(
      me.id,
      id,
      { outcome: "continued", criteria_verdict: "not_met" },
      new Date(),
    );
    expect((await saveReview(me.id, id, new Date())).ok).toBe(true);
    const o = await objective();
    expect(o.status).toBe("active");
    expect(o.status_history.map((e) => e.change)).toEqual(["created"]);
  });
});
