import { afterAll, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import type { Day, Deviation, Objective } from "@/shared/contract";
import * as objectives from "@/app/v1/objectives/route";
import * as objective from "@/app/v1/objectives/[objectiveId]/route";
import * as effortEntries from "@/app/v1/objectives/[objectiveId]/effort-entries/route";
import * as effortMonth from "@/app/v1/objectives/[objectiveId]/effort/route";
import * as reviewsOf from "@/app/v1/objectives/[objectiveId]/reviews/route";
import * as review from "@/app/v1/reviews/[reviewId]/route";
import * as save from "@/app/v1/reviews/[reviewId]/save/route";
import * as judge from "@/app/v1/reviews/[reviewId]/deviation-verdicts/[deviationId]/route";
import * as patterns from "@/app/v1/deviation-patterns/route";
import * as deviations from "@/app/v1/deviations/route";
import * as ideas from "@/app/v1/parked-ideas/route";
import * as day from "@/app/v1/day/[date]/route";
import { testUser, type TestUser } from "@/test/fixtures";
import type {
  Review,
  ReviewSummary,
} from "@/modules/reviews/domain/assembleReview";
import type { ParkedIdea } from "@/modules/parking/domain/parking";
import type { EffortMonth } from "@/modules/effort/domain/effortMonth";

/**
 * I-02's check, as intent.md states it: one run takes an objective from
 * created to completed, with effort, deviations, parked ideas and a review
 * attached, and reads the whole story back — all through the API, with no
 * screen. Every call goes through a real route handler with the user's
 * session cookie, and nothing is set up behind the API's back.
 *
 * Back-dated: the objective ran Mon 2026-09-14 … Sun 2026-10-11, so every
 * review window has closed. scripts/story-check.mjs runs the same story over
 * HTTP against a running service.
 */
const BASE = "http://keel.test";
let me: TestUser;

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (req: Request, ctx: Ctx) => Promise<Response>;

/** Call a route as the signed-in user; expect `status`; return the body. */
async function call<T>(
  handler: unknown,
  method: string,
  path: string,
  params: Record<string, string>,
  status: number,
  body?: unknown,
): Promise<T> {
  const res = await (handler as Handler)(
    new Request(`${BASE}${path}`, {
      method,
      headers: { cookie: me.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve(params) },
  );
  const text = await res.text();
  expect(res.status, `${method} ${path}: ${text}`).toBe(status);
  return (text ? JSON.parse(text) : undefined) as T;
}

describe("I-02 — the whole story, through the API", () => {
  afterAll(async () => {
    await getPool().end();
  });

  it("takes an objective from created to completed, and reads it all back", async () => {
    me = await testUser("Asia/Kolkata");

    // 1. Declare the objective.
    const o = await call<Objective>(
      objectives.POST,
      "POST",
      "/v1/objectives",
      {},
      201,
      {
        title: "Ship the backend",
        why_now: "The record only matters if it is kept.",
        success_criteria: "Every operation in the contract is real.",
        schedule: {
          mode: "fixed",
          planned_weekdays: [1, 2, 3, 4, 5],
          minutes_per_planned_day: 60,
        },
        starts_on: "2026-09-14",
        tz: "Asia/Kolkata",
        runs_for_days: 28,
        review_cadence: "weekly",
      },
    );
    const id = o.id;
    const oid = { objectiveId: id };

    // 2. Effort on planned days, and one off day.
    for (const [local_date, minutes] of [
      ["2026-09-14", 60],
      ["2026-09-15", 45],
      ["2026-09-22", 60],
      ["2026-09-26", 30], // Saturday: extra
      ["2026-10-05", 60],
    ] as const) {
      await call(
        effortEntries.POST,
        "POST",
        `/v1/objectives/${id}/effort-entries`,
        oid,
        201,
        {
          local_date,
          tz: "Asia/Kolkata",
          occurred_at_local: "09:00",
          minutes,
          note: "Worked on it.",
        },
      );
    }

    // 3. A named pattern, and a chosen deviation that names the objective.
    const pattern = await call<{ id: string }>(
      patterns.POST,
      "POST",
      "/v1/deviation-patterns",
      {},
      201,
      {
        name: "Saying yes",
      },
    );
    const deviation = await call<Deviation>(
      deviations.POST,
      "POST",
      "/v1/deviations",
      {},
      201,
      {
        objective_ids: [id],
        local_date: "2026-09-16",
        tz: "Asia/Kolkata",
        kind: "chosen",
        what_happened: "Helped a friend move.",
        reasoning: "It mattered more that day.",
        minutes: 120,
        pattern_id: pattern.id,
      },
    );

    // 4. An idea caught mid-plan, locked until the plan ends.
    const idea = await call<ParkedIdea>(
      ideas.POST,
      "POST",
      "/v1/parked-ideas",
      {},
      201,
      {
        idea: "Write about this",
        why: "It keeps coming back.",
        caught_on: "2026-09-17",
      },
    );
    expect(idea.locked_until).toBe("2026-10-11");

    // 5. Review every week: judge the deviation in Week 1, then save each.
    const reviewIds: string[] = [];
    for (const label of ["Week 1", "Week 2", "Week 3"]) {
      const draft = await call<Review>(
        reviewsOf.POST,
        "POST",
        `/v1/objectives/${id}/reviews`,
        oid,
        201,
      );
      expect(draft.label).toBe(label);
      const rid = { reviewId: draft.id };
      if (label === "Week 1") {
        expect(draft.deviations.map((d) => d.id)).toEqual([deviation.id]);
        await call(save.POST, "POST", `/v1/reviews/${draft.id}/save`, rid, 422);
        await call(
          judge.PUT,
          "PUT",
          `/v1/reviews/${draft.id}/deviation-verdicts/${deviation.id}`,
          { reviewId: draft.id, deviationId: deviation.id },
          200,
          { verdict: "worth_it" },
        );
      }
      await call(review.PATCH, "PATCH", `/v1/reviews/${draft.id}`, rid, 200, {
        what_worked: "Showed up.",
        what_changes_next: `Better than ${label}.`,
        review_summary: `${label}, recorded.`,
      });
      await call(save.POST, "POST", `/v1/reviews/${draft.id}/save`, rid, 200);
      reviewIds.push(draft.id);
    }

    // 6. The plan-end review completes it.
    const planEnd = await call<Review>(
      reviewsOf.POST,
      "POST",
      `/v1/objectives/${id}/reviews`,
      oid,
      201,
    );
    expect(planEnd).toMatchObject({ kind: "plan_end", label: "End of plan" });
    expect(planEnd.previous_what_changes_next).toBe("Better than Week 3.");
    await call(
      review.PATCH,
      "PATCH",
      `/v1/reviews/${planEnd.id}`,
      { reviewId: planEnd.id },
      200,
      {
        criteria_assessment: "Most of it.",
        criteria_verdict: "partly_met",
        outcome: "completed",
        review_summary: "Done, mostly.",
      },
    );
    await call(
      save.POST,
      "POST",
      `/v1/reviews/${planEnd.id}/save`,
      { reviewId: planEnd.id },
      200,
    );

    // 7. Read the whole story back.
    const done = await call<Objective>(
      objective.GET,
      "GET",
      `/v1/objectives/${id}`,
      oid,
      200,
    );
    expect(done).toMatchObject({
      status: "completed",
      criteria_verdict: "partly_met",
      next_review_on: null,
      reviews_due: 0,
      figures: { logged_minutes: 255, extra_off_day_minutes: 30 },
    });
    expect(done.status_history.map((e) => [e.change, e.occurred_on])).toEqual([
      ["created", "2026-09-14"],
      ["completed", "2026-10-11"],
    ]);

    const { reviews } = await call<{ reviews: ReviewSummary[] }>(
      reviewsOf.GET,
      "GET",
      `/v1/objectives/${id}/reviews`,
      oid,
      200,
    );
    expect(reviews.map((r) => [r.label, r.status])).toEqual([
      ["Week 1", "saved"],
      ["Week 2", "saved"],
      ["Week 3", "saved"],
      ["End of plan", "saved"],
    ]);

    const week2 = await call<Review>(
      review.GET,
      "GET",
      `/v1/reviews/${reviewIds[1]}`,
      { reviewId: reviewIds[1] },
      200,
    );
    expect(week2).toMatchObject({
      previous_review_id: reviewIds[0],
      previous_what_changes_next: "Better than Week 1.",
    });

    const listed = await call<{ deviations: Deviation[] }>(
      deviations.GET,
      "GET",
      `/v1/deviations?from=2026-09-01&to=2026-10-31&objective_id=${id}`,
      {},
      200,
    );
    expect(listed.deviations[0]).toMatchObject({
      verdict: "worth_it",
      verdict_review_id: reviewIds[0],
      pattern_name: "Saying yes",
    });

    const parked = await call<{ ideas: ParkedIdea[] }>(
      ideas.GET,
      "GET",
      "/v1/parked-ideas",
      {},
      200,
    );
    expect(parked.ideas.map((i) => i.idea)).toEqual(["Write about this"]);

    const september = await call<EffortMonth>(
      effortMonth.GET,
      "GET",
      `/v1/objectives/${id}/effort?month=2026-09`,
      oid,
      200,
    );
    expect(september.totals).toMatchObject({
      logged_minutes: 255,
      sessions: 5,
    });

    // Completed objectives are not on Today, but the deviation still is.
    const today = await call<Day>(
      day.GET,
      "GET",
      "/v1/day/2026-10-12",
      { date: "2026-10-12" },
      200,
    );
    expect(today.objectives).toEqual([]);
    expect(today.last_deviation?.id).toBe(deviation.id);
  });

  it("stores nothing the ERD says is computed (NFR-09)", async () => {
    // Adherence, totals, streaks, counts, labels, sequence numbers, the current
    // verdict or status, the objective's dates — none of them is a column.
    const res = await query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name ~ '(adherence|total|streak|count|occurrences|label|logged_minutes|target_minutes|due_on|locked$|became_objective|current_|^status$|end_date)'
         AND NOT (table_name = 'plan_segment' AND column_name = 'end_date')
         AND NOT (table_name = 'review' AND column_name = 'status')`,
    );
    expect(res.rows).toEqual([]);
  });
});
