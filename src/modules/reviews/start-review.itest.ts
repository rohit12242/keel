import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPool, query } from "@/shared/db";
import * as reviewsOf from "@/app/v1/objectives/[objectiveId]/reviews/route";
import * as one from "@/app/v1/reviews/[reviewId]/route";
import {
  testEntry,
  testIdea,
  testObjective,
  testUser,
  type TestUser,
} from "@/test/fixtures";
import { createDeviation } from "@/modules/deviations/service";
import type { Review, ReviewSummary } from "./domain/assembleReview";

/**
 * I-02 step 23 — starting, resuming and reading a review, every declared
 * response. The objective is fixed Mon–Fri, 120 minutes, Mon 2026-09-14 …
 * Sun 2026-10-11, reviewed weekly: all four windows have closed.
 */
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return { ...actual, query: vi.fn(actual.query) };
});

let me: TestUser;
let objectiveId: string;

const start = (body?: unknown, id = objectiveId) =>
  reviewsOf.POST(
    new Request(`http://keel.test/v1/objectives/${id}/reviews`, {
      method: "POST",
      headers: { cookie: me.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ objectiveId: id }) },
  );
const read = (id: string) =>
  one.GET(
    new Request(`http://keel.test/v1/reviews/${id}`, {
      headers: { cookie: me.cookie },
    }),
    { params: Promise.resolve({ reviewId: id }) },
  );

describe("starting and reading a review (real Postgres)", () => {
  beforeAll(async () => {
    me = await testUser();
    objectiveId = (await testObjective(me)).id;
    await testEntry(objectiveId, {
      local_date: "2026-09-14",
      minutes: 120,
    });
    await testEntry(objectiveId, { local_date: "2026-09-15", minutes: 60 });
    await testEntry(objectiveId, { local_date: "2026-09-19", minutes: 30 });
    const d = await createDeviation(
      me.id,
      {
        objective_ids: [objectiveId],
        local_date: "2026-09-16",
        tz: "Asia/Kolkata",
        kind: "chosen",
        what_happened: "w",
        reasoning: "r",
        minutes: 45,
      },
      new Date(),
    );
    expect(d.ok).toBe(true);
    await testIdea(me, "2026-09-17");
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("201s the due week as a draft, then 200s the same draft", async () => {
    const first = await start();
    expect(first.status).toBe(201);
    const review = (await first.json()) as Review;
    expect(review).toMatchObject({
      kind: "weekly",
      label: "Week 1",
      period_start: "2026-09-14",
      period_end: "2026-09-20",
      due_on: "2026-09-20",
      status: "draft",
      previous_review_id: null,
    });
    expect(review.figures).toMatchObject({
      logged_minutes: 210,
      target_minutes: 600,
      planned_days_worked: 2,
      extra_off_day_minutes: 30,
    });
    expect(review.deviations.map((d) => d.local_date)).toEqual(["2026-09-16"]);
    expect(review.parked_ideas.map((i) => i.caught_on)).toEqual(["2026-09-17"]);

    const again = await start();
    expect(again.status).toBe(200);
    expect(((await again.json()) as Review).id).toBe(review.id);
  });

  it("reads one review in one query, and lists the reviews in period order", async () => {
    const draft = (await (await start()).json()) as Review;
    vi.mocked(query).mockClear();
    const res = await read(draft.id);
    expect(res.status).toBe(200);
    expect(vi.mocked(query)).toHaveBeenCalledTimes(1);

    await start({ period_start: "2026-09-28", period_end: "2026-10-04" });
    vi.mocked(query).mockClear();
    const listed = await reviewsOf.GET(
      new Request(`http://keel.test/v1/objectives/${objectiveId}/reviews`, {
        headers: { cookie: me.cookie },
      }),
      { params: Promise.resolve({ objectiveId }) },
    );
    expect(vi.mocked(query)).toHaveBeenCalledTimes(1);
    const { reviews } = (await listed.json()) as { reviews: ReviewSummary[] };
    expect(reviews.map((r) => r.label)).toEqual(["Week 1", "Week 3"]);
  });

  it("400s a period that is not a window, or a body that is not JSON", async () => {
    expect(
      (await start({ period_start: "2026-09-15", period_end: "2026-09-21" }))
        .status,
    ).toBe(400);
    expect((await start({ period_start: "2026-09-14" })).status).toBe(400);
  });

  it("409s a period already saved", async () => {
    await query(
      `INSERT INTO review (objective_id, kind, period_start, period_end, status, saved_at)
       VALUES ($1, 'weekly', '2026-09-21', '2026-09-27', 'saved', now())`,
      [objectiveId],
    );
    expect(
      (await start({ period_start: "2026-09-21", period_end: "2026-09-27" }))
        .status,
    ).toBe(409);
  });

  it("422s with no body when nothing is due, and 400s a window not yet closed", async () => {
    const future = (await testObjective(me, { starts_on: "2099-01-05" })).id;
    expect((await start(undefined, future)).status).toBe(422);
    expect(
      (
        await start(
          { period_start: "2099-01-05", period_end: "2099-01-11" },
          future,
        )
      ).status,
    ).toBe(400);
  });

  it("404s an id that is not a UUID, or another user's objective or review", async () => {
    expect((await start(undefined, "nope")).status).toBe(404);
    expect((await read("nope")).status).toBe(404);
    const them = await testUser();
    const theirs = (await testObjective(them)).id;
    expect((await start(undefined, theirs)).status).toBe(404);
  });
});
