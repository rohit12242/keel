import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import * as route from "@/app/v1/reviews/[reviewId]/route";
import { testReview, testUser, type TestUser } from "@/test/fixtures";
import type { Review } from "./domain/assembleReview";

/** I-02 step 24 — autosaving and discarding a draft, every declared response. */
let me: TestUser;
let reviewId: string;

const params = (id: string) => ({ params: Promise.resolve({ reviewId: id }) });
const patch = (body: unknown, id = reviewId) =>
  route.PATCH(
    new Request(`http://keel.test/v1/reviews/${id}`, {
      method: "PATCH",
      headers: { cookie: me.cookie },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    params(id),
  );
const discard = (id = reviewId) =>
  route.DELETE(
    new Request(`http://keel.test/v1/reviews/${id}`, {
      method: "DELETE",
      headers: { cookie: me.cookie },
    }),
    params(id),
  );
const markSaved = (id: string) =>
  query(`UPDATE review SET status = 'saved', saved_at = now() WHERE id = $1`, [
    id,
  ]);

describe("autosave and discard (real Postgres)", () => {
  beforeEach(async () => {
    me = await testUser();
    reviewId = (await testReview(me)).id; // a weekly draft
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("200s an autosave and returns the review with its answers", async () => {
    const res = await patch({
      improvement_answer: "partly",
      what_worked: "Showed up.",
      review_summary: "A steady week.",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: reviewId,
      status: "draft",
      improvement_answer: "partly",
      what_worked: "Showed up.",
      review_summary: "A steady week.",
    });
    const cleared = (await (
      await patch({ what_worked: null })
    ).json()) as Review;
    expect(cleared.what_worked).toBeNull();
    expect(cleared.review_summary).toBe("A steady week.");
  });

  it("422s a plan-end field on a weekly review", async () => {
    expect((await patch({ outcome: "completed" })).status).toBe(422);
  });

  it("400s a malformed field or a body that is not JSON", async () => {
    expect((await patch({ improvement_answer: "maybe" })).status).toBe(400);
    expect((await patch("{nope")).status).toBe(400);
  });

  it("409s an autosave or a discard of a saved review, and changes nothing", async () => {
    await markSaved(reviewId);
    expect((await patch({ review_summary: "rewritten" })).status).toBe(409);
    expect((await discard()).status).toBe(409);
    const row = await query<{ review_summary: string | null }>(
      `SELECT review_summary FROM review WHERE id = $1`,
      [reviewId],
    );
    expect(row.rows[0].review_summary).toBeNull();
  });

  it("204s a discard, and the draft is gone", async () => {
    expect((await discard()).status).toBe(204);
    const row = await query(`SELECT 1 FROM review WHERE id = $1`, [reviewId]);
    expect(row.rowCount).toBe(0);
  });

  it("404s an id that is not a UUID, or another user's review", async () => {
    expect((await patch({}, "nope")).status).toBe(404);
    expect((await discard("nope")).status).toBe(404);
    const theirs = (await testReview(await testUser())).id;
    expect((await patch({ review_summary: "x" }, theirs)).status).toBe(404);
    expect((await discard(theirs)).status).toBe(404);
  });
});
