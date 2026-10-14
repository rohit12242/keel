import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import type { Deviation } from "@/shared/contract";
import * as route from "@/app/v1/reviews/[reviewId]/deviation-verdicts/[deviationId]/route";
import {
  testDeviation,
  testReview,
  testUser,
  type TestUser,
} from "@/test/fixtures";

/**
 * I-02 step 25 — a review judging a chosen deviation, every declared
 * response. The review is Week 1, 2026-09-14 … 2026-09-20; deviations are
 * dated 2026-09-16 unless a case says otherwise.
 */
let me: TestUser;
let review: { id: string; objective_id: string };

const put = (deviationId: string, body: unknown, reviewId = review.id) =>
  route.PUT(
    new Request(
      `http://keel.test/v1/reviews/${reviewId}/deviation-verdicts/${deviationId}`,
      {
        method: "PUT",
        headers: { cookie: me.cookie },
        body: JSON.stringify(body),
      },
    ),
    { params: Promise.resolve({ reviewId, deviationId }) },
  );

describe("deviation verdicts (real Postgres)", () => {
  beforeEach(async () => {
    me = await testUser();
    review = await testReview(me);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("200s a verdict naming the review, and the same verdict again leaves one", async () => {
    const d = await testDeviation(me, [review.objective_id]);
    const res = await put(d.id, { verdict: "worth_it" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: d.id,
      verdict: "worth_it",
      verdict_review_id: review.id,
    });
    expect((await put(d.id, { verdict: "worth_it" })).status).toBe(200);
    const changed = (await (
      await put(d.id, { verdict: "not_worth_it" })
    ).json()) as Deviation;
    expect(changed.verdict).toBe("not_worth_it");
  });

  it("422s a drifted deviation, one outside the period, or one not naming the objective", async () => {
    const drifted = await testDeviation(me, [review.objective_id], {
      kind: "drifted",
    });
    expect((await put(drifted.id, { verdict: "worth_it" })).status).toBe(422);
    const later = await testDeviation(me, [review.objective_id], {
      local_date: "2026-09-22",
    });
    expect((await put(later.id, { verdict: "worth_it" })).status).toBe(422);
    const other = await testReview(me);
    const elsewhere = await testDeviation(me, [other.objective_id]);
    expect((await put(elsewhere.id, { verdict: "worth_it" })).status).toBe(422);
  });

  it("409s a deviation another review already judged", async () => {
    const other = await testReview(me);
    const d = await testDeviation(me, [
      review.objective_id,
      other.objective_id,
    ]);
    expect((await put(d.id, { verdict: "worth_it" }, other.id)).status).toBe(
      200,
    );
    expect((await put(d.id, { verdict: "not_worth_it" })).status).toBe(409);
  });

  it("409s a new verdict from a saved review", async () => {
    const d = await testDeviation(me, [review.objective_id]);
    await query(
      `UPDATE review SET status = 'saved', saved_at = now() WHERE id = $1`,
      [review.id],
    );
    expect((await put(d.id, { verdict: "worth_it" })).status).toBe(409);
  });

  it("400s a verdict that is not one", async () => {
    const d = await testDeviation(me, [review.objective_id]);
    expect((await put(d.id, { verdict: "maybe" })).status).toBe(400);
  });

  it("404s ids that are not UUIDs, or are someone else's", async () => {
    const d = await testDeviation(me, [review.objective_id]);
    expect((await put(d.id, { verdict: "worth_it" }, "nope")).status).toBe(404);
    expect((await put("nope", { verdict: "worth_it" })).status).toBe(404);
    const them = await testUser();
    const theirReview = await testReview(them);
    const theirs = await testDeviation(them, [theirReview.objective_id]);
    expect((await put(theirs.id, { verdict: "worth_it" })).status).toBe(404);
    expect(
      (await put(d.id, { verdict: "worth_it" }, theirReview.id)).status,
    ).toBe(404);
  });
});
