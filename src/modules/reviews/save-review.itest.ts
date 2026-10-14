import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool } from "@/shared/db";
import type { ObjectiveSummary } from "@/shared/contract";
import * as save from "@/app/v1/reviews/[reviewId]/save/route";
import * as verdict from "@/app/v1/reviews/[reviewId]/deviation-verdicts/[deviationId]/route";
import * as one from "@/app/v1/objectives/[objectiveId]/route";
import {
  testDeviation,
  testObjective,
  testReview,
  testUser,
  type TestUser,
} from "@/test/fixtures";
import type { Review } from "./domain/assembleReview";

/**
 * I-02 step 26 — saving a weekly review, every declared response. The
 * objective runs Mon 2026-09-14 … Sun 2026-10-11, weekly: Week 1 … Week 3,
 * then End of plan, all closed.
 */
let me: TestUser;
let objectiveId: string;

const saveIt = (id: string) =>
  save.POST(
    new Request(`http://keel.test/v1/reviews/${id}/save`, {
      method: "POST",
      headers: { cookie: me.cookie },
    }),
    { params: Promise.resolve({ reviewId: id }) },
  );
const judge = (reviewId: string, deviationId: string) =>
  verdict.PUT(
    new Request(
      `http://keel.test/v1/reviews/${reviewId}/deviation-verdicts/${deviationId}`,
      {
        method: "PUT",
        headers: { cookie: me.cookie },
        body: JSON.stringify({ verdict: "not_worth_it" }),
      },
    ),
    { params: Promise.resolve({ reviewId, deviationId }) },
  );
const objective = async () =>
  (await (
    await one.GET(
      new Request(`http://keel.test/v1/objectives/${objectiveId}`, {
        headers: { cookie: me.cookie },
      }),
      { params: Promise.resolve({ objectiveId }) },
    )
  ).json()) as ObjectiveSummary;

describe("saving a review (real Postgres)", () => {
  beforeEach(async () => {
    me = await testUser();
    objectiveId = (await testObjective(me)).id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("422s while a chosen deviation of the period is unjudged, then saves once judged", async () => {
    const week1 = await testReview(me, objectiveId);
    const d = await testDeviation(me, [objectiveId]);
    expect((await saveIt(week1.id)).status).toBe(422);

    expect((await judge(week1.id, d.id)).status).toBe(200);
    const res = await saveIt(week1.id);
    expect(res.status).toBe(200);
    const saved = (await res.json()) as Review;
    expect(saved).toMatchObject({ status: "saved", previous_review_id: null });
    expect(saved.saved_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect((await objective()).next_review_on).toBe("2026-09-27");
  });

  it("fixes the review it answers when saved", async () => {
    const week1 = await testReview(me, objectiveId);
    await saveIt(week1.id);
    const week2 = await testReview(me, objectiveId);
    const saved = (await (await saveIt(week2.id)).json()) as Review;
    expect(saved).toMatchObject({
      label: "Week 2",
      previous_review_id: week1.id,
    });
  });

  it("409s a review already saved", async () => {
    const week1 = await testReview(me, objectiveId);
    await saveIt(week1.id);
    expect((await saveIt(week1.id)).status).toBe(409);
  });

  it("404s an id that is not a UUID, or another user's review", async () => {
    expect((await saveIt("nope")).status).toBe(404);
    const theirs = await testReview(await testUser());
    expect((await saveIt(theirs.id)).status).toBe(404);
  });
});
