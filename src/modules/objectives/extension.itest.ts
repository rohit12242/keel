import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool } from "@/shared/db";
import type { Objective, PlanSegment } from "@/shared/contract";
import * as extensions from "@/app/v1/objectives/[objectiveId]/extensions/route";
import * as one from "@/app/v1/objectives/[objectiveId]/route";
import * as grid from "@/app/v1/objectives/[objectiveId]/schedule/route";
import * as reviewList from "@/app/v1/objectives/[objectiveId]/reviews/route";
import type { ReviewList, ScheduleGrid } from "@/shared/contract";
import {
  testObjective,
  testReview,
  testUser,
  todayIn,
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
  review_cadence: "weekly",
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
    // Made after the plan ended, so dated the day it was made (I-14).
    expect(o.status_history.at(-1)).toMatchObject({
      change: "extended",
      occurred_on: segment.plans_from,
      new_end_date: segment.end_date,
    });
  });

  it("plans a late extension from today: the days since the plan ended are never missed (G48)", async () => {
    const reviewId = await closePlan("continued");
    const res = await extend(body(reviewId, { extend_by_days: 14 }));
    expect(res.status).toBe(201);
    const today = todayIn("Asia/Kolkata");
    const segment = (await res.json()) as PlanSegment;
    expect(segment).toMatchObject({
      start_date: "2026-10-12",
      plans_from: today,
      end_date: new Date(Date.parse(`${today}T00:00:00Z`) + 13 * DAY)
        .toISOString()
        .slice(0, 10),
    });

    // The gap: from the extension's start to the day before it plans.
    const gapEnd = new Date(Date.parse(`${today}T00:00:00Z`) - DAY)
      .toISOString()
      .slice(0, 10);
    const days = (await (
      await grid.GET(
        new Request(
          `http://keel.test/v1/objectives/${objectiveId}/schedule?from=2026-10-12&to=${gapEnd}`,
          { headers: { cookie: me.cookie } },
        ),
        { params: Promise.resolve({ objectiveId }) },
      )
    ).json()) as ScheduleGrid;
    expect(days.days.length).toBeGreaterThan(0);
    expect(days.days.every((d) => d.state === "off_day")).toBe(true);

    // Nothing in the gap is owed: no window of it is due.
    const o = (await (
      await one.GET(
        new Request(`http://keel.test/v1/objectives/${objectiveId}`, {
          headers: { cookie: me.cookie },
        }),
        { params: Promise.resolve({ objectiveId }) },
      )
    ).json()) as Objective;
    expect(o.reviews_due).toBe(0);
  });

  it("gives the extension its own cadence, and leaves the saved reviews' windows where they were (I-14)", async () => {
    const reviewId = await closePlan("continued");
    const list = async () =>
      (await (
        await reviewList.GET(
          new Request(`http://keel.test/v1/objectives/${objectiveId}/reviews`, {
            headers: { cookie: me.cookie },
          }),
          { params: Promise.resolve({ objectiveId }) },
        )
      ).json()) as ReviewList;
    const before = (await list()).reviews.map((r) => [
      r.label,
      r.period_start,
      r.period_end,
    ]);

    const res = await extend(body(reviewId, { review_cadence: "monthly" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ review_cadence: "monthly" });

    const o = (await (
      await one.GET(
        new Request(`http://keel.test/v1/objectives/${objectiveId}`, {
          headers: { cookie: me.cookie },
        }),
        { params: Promise.resolve({ objectiveId }) },
      )
    ).json()) as Objective;
    expect(o.review_cadence).toBe("monthly");
    expect(o.segments.map((s) => s.review_cadence)).toEqual([
      "weekly",
      "monthly",
    ]);
    expect(
      (await list()).reviews.map((r) => [
        r.label,
        r.period_start,
        r.period_end,
      ]),
    ).toEqual(before);
  });

  it("400s an extension without its review cadence", async () => {
    const reviewId = await closePlan("continued");
    expect(
      (await extend(body(reviewId, { review_cadence: undefined }))).status,
    ).toBe(400);
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

  it("422s a flexible schedule, and writes no segment: v1 plans fixed objectives only (I-09)", async () => {
    const reviewId = await closePlan("continued");
    const res = await extend(
      body(reviewId, {
        schedule: {
          mode: "flexible",
          days_per_week: 3,
          minutes_per_planned_day: 60,
        },
      }),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      type: expect.stringMatching(/\/fixed-only$/),
    });
    // The same review still extends the plan with a fixed schedule: nothing
    // was written by the refusal.
    expect((await extend(body(reviewId))).status).toBe(201);
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
