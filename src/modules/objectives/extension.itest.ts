import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool } from "@/shared/db";
import type { Objective, PlanSegment } from "@/shared/contract";
import * as extensions from "@/app/v1/objectives/[objectiveId]/extensions/route";
import * as one from "@/app/v1/objectives/[objectiveId]/route";
import {
  testObjective,
  testReview,
  testUser,
  type TestUser,
} from "@/test/fixtures";
import { saveReview, updateReview } from "@/modules/reviews/service";

/**
 * I-02 step 28 — extending a plan, every declared response. The objective
 * runs Mon 2026-09-14 … Sun 2026-10-11, weekly, all of it past. The
 * extension starts 2026-10-12 and is sized to end a month after today.
 */
const DAY = 86_400_000;
const daysToAMonthFromNow =
  Math.ceil((Date.now() - Date.parse("2026-10-12T00:00:00Z")) / DAY) + 31;

let me: TestUser;
let objectiveId: string;

/** Save Week 1 … 3, then the plan-end review with `outcome`; its id. */
async function closePlan(outcome: "continued" | "completed"): Promise<string> {
  for (let week = 1; week <= 3; week++) {
    const r = await testReview(me, objectiveId);
    await saveReview(me.id, r.id, new Date());
  }
  const planEnd = await testReview(me, objectiveId);
  await updateReview(
    me.id,
    planEnd.id,
    { outcome, criteria_verdict: "partly_met" },
    new Date(),
  );
  const saved = await saveReview(me.id, planEnd.id, new Date());
  if (!saved.ok) throw new Error(JSON.stringify(saved));
  return planEnd.id;
}

const extend = (body: Record<string, unknown>, id = objectiveId) =>
  extensions.POST(
    new Request(`http://keel.test/v1/objectives/${id}/extensions`, {
      method: "POST",
      headers: { cookie: me.cookie },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ objectiveId: id }) },
  );
const body = (reviewId: string, over: Record<string, unknown> = {}) => ({
  review_id: reviewId,
  extend_by_days: daysToAMonthFromNow,
  reason: "Close, but not done.",
  schedule: {
    mode: "fixed",
    planned_weekdays: [1, 3],
    minutes_per_planned_day: 90,
  },
  ...over,
});

describe("extending a plan (real Postgres)", () => {
  beforeEach(async () => {
    me = await testUser();
    objectiveId = (await testObjective(me)).id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("201s the next segment, authorised by the continued review, and the plan reads it", async () => {
    const reviewId = await closePlan("continued");
    const res = await extend(body(reviewId));
    expect(res.status).toBe(201);
    const segment = (await res.json()) as PlanSegment;
    expect(segment).toMatchObject({
      seq: 1,
      start_date: "2026-10-12",
      reason: "Close, but not done.",
      created_by_review_id: reviewId,
      schedule: {
        mode: "fixed",
        planned_weekdays: [1, 3],
        minutes_per_planned_day: 90,
      },
    });

    const o = (await (
      await one.GET(
        new Request(`http://keel.test/v1/objectives/${objectiveId}`, {
          headers: { cookie: me.cookie },
        }),
        { params: Promise.resolve({ objectiveId }) },
      )
    ).json()) as Objective;
    expect(o).toMatchObject({
      extension_count: 1,
      original_end_date: "2026-10-11",
      end_date: segment.end_date,
    });
    expect(o.status_history.at(-1)).toMatchObject({
      change: "extended",
      occurred_on: "2026-10-12",
      new_end_date: segment.end_date,
    });
  });

  it("409s a second extension from the same review", async () => {
    const reviewId = await closePlan("continued");
    expect((await extend(body(reviewId))).status).toBe(201);
    expect((await extend(body(reviewId))).status).toBe(409);
  });

  it("409s a review whose outcome is not continued, or no such review", async () => {
    const reviewId = await closePlan("completed");
    expect((await extend(body(reviewId))).status).toBe(409);
    expect(
      (await extend(body("00000000-0000-0000-0000-00000000dead"))).status,
    ).toBe(409);
  });

  it("422s an extension that would not end after today", async () => {
    const reviewId = await closePlan("continued");
    expect((await extend(body(reviewId, { extend_by_days: 1 }))).status).toBe(
      422,
    );
  });

  it("400s a body that is not an extension", async () => {
    expect((await extend({ extend_by_days: 0 })).status).toBe(400);
  });

  it("404s an id that is not a UUID, or another user's objective", async () => {
    expect(
      (await extend(body("00000000-0000-0000-0000-00000000dead"), "nope"))
        .status,
    ).toBe(404);
    const theirs = (await testObjective(await testUser())).id;
    expect(
      (await extend(body("00000000-0000-0000-0000-00000000dead"), theirs))
        .status,
    ).toBe(404);
  });
});
