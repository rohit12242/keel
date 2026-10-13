import * as day from "@/app/v1/day/[date]/route";
import * as objectives from "@/app/v1/objectives/route";
import * as objective from "@/app/v1/objectives/[objectiveId]/route";
import * as schedule from "@/app/v1/objectives/[objectiveId]/schedule/route";
import * as effortEntries from "@/app/v1/objectives/[objectiveId]/effort-entries/route";
import * as session from "@/app/v1/session/route";
import * as entry from "@/app/v1/effort-entries/[entryId]/route";
import * as effortMonth from "@/app/v1/objectives/[objectiveId]/effort/route";
import * as patterns from "@/app/v1/deviation-patterns/route";
import * as deviations from "@/app/v1/deviations/route";
import * as ideas from "@/app/v1/parked-ideas/route";
import * as reviewsOf from "@/app/v1/objectives/[objectiveId]/reviews/route";
import * as review from "@/app/v1/reviews/[reviewId]/route";
import * as verdicts from "@/app/v1/parked-ideas/[ideaId]/verdicts/route";
import * as statusChanges from "@/app/v1/objectives/[objectiveId]/status-changes/route";
import {
  OBJECTIVE_BODY,
  testEntry,
  testIdea,
  testReview,
  testObjective,
  type TestUser,
} from "./fixtures";

/**
 * One row per operation that needs a session (NFR-10, NFR-11's
 * authorisation suite). `src/authorization.itest.ts` runs every row twice:
 * with no cookie it must answer 401, and — when the path names a row — with
 * someone else's row it must answer 404, never 403.
 *
 * `src/contract-coverage.itest.ts` fails if an operation with a handler and
 * a session requirement has no row here, so a route cannot be added without
 * being checked.
 */
export type AuthRow = {
  operationId: string;
  /** Creates the row the path names, owned by `user`. Absent: no id in the path. */
  resource?: (user: TestUser) => Promise<string>;
  call: (cookie: string | null, id: string) => Promise<Response>;
};

const BASE = "http://keel.test";

function req(
  method: string,
  path: string,
  cookie: string | null,
  body?: unknown,
): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: cookie ? { cookie } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const objectiveParams = (objectiveId: string) => ({
  params: Promise.resolve({ objectiveId }),
});

const anObjective = async (user: TestUser) => (await testObjective(user)).id;

const anEntry = async (user: TestUser) =>
  (await testEntry(user, await anObjective(user))).id;

const aReview = async (user: TestUser) => (await testReview(user)).id;

const reviewParams = (reviewId: string) => ({
  params: Promise.resolve({ reviewId }),
});

const entryParams = (entryId: string) => ({
  params: Promise.resolve({ entryId }),
});

export const AUTHORIZATION: AuthRow[] = [
  {
    operationId: "deleteSession",
    call: (cookie) =>
      session.DELETE(req("DELETE", "/v1/session", cookie), undefined),
  },
  {
    operationId: "getDay",
    call: (cookie) =>
      day.GET(req("GET", "/v1/day/2026-09-16", cookie), {
        params: Promise.resolve({ date: "2026-09-16" }),
      }),
  },
  {
    operationId: "listObjectives",
    call: (cookie) =>
      objectives.GET(req("GET", "/v1/objectives", cookie), undefined),
  },
  {
    operationId: "createObjective",
    call: (cookie) =>
      objectives.POST(
        req("POST", "/v1/objectives", cookie, OBJECTIVE_BODY),
        undefined,
      ),
  },
  {
    operationId: "getObjective",
    resource: anObjective,
    call: (cookie, id) =>
      objective.GET(
        req("GET", `/v1/objectives/${id}`, cookie),
        objectiveParams(id),
      ),
  },
  {
    operationId: "getObjectiveSchedule",
    resource: anObjective,
    call: (cookie, id) =>
      schedule.GET(
        req("GET", `/v1/objectives/${id}/schedule`, cookie),
        objectiveParams(id),
      ),
  },
  {
    operationId: "createEffortEntry",
    resource: anObjective,
    // A valid body, so a 404 cannot be a 400 in disguise.
    call: (cookie, id) =>
      effortEntries.POST(
        req("POST", `/v1/objectives/${id}/effort-entries`, cookie, {
          local_date: "2026-09-16",
          tz: "Asia/Kolkata",
          minutes: 30,
          note: "itest: authorisation",
        }),
        objectiveParams(id),
      ),
  },
  {
    operationId: "updateEffortEntry",
    resource: anEntry,
    call: (cookie, id) =>
      entry.PATCH(
        req("PATCH", `/v1/effort-entries/${id}`, cookie, { minutes: 5 }),
        entryParams(id),
      ),
  },
  {
    operationId: "deleteEffortEntry",
    resource: anEntry,
    call: (cookie, id) =>
      entry.DELETE(
        req("DELETE", `/v1/effort-entries/${id}`, cookie),
        entryParams(id),
      ),
  },
  {
    operationId: "listObjectiveEffort",
    resource: anObjective,
    call: (cookie, id) =>
      effortMonth.GET(
        req("GET", `/v1/objectives/${id}/effort?month=2026-09`, cookie),
        objectiveParams(id),
      ),
  },
  {
    operationId: "createStatusChange",
    resource: anObjective,
    call: (cookie, id) =>
      statusChanges.POST(
        req("POST", `/v1/objectives/${id}/status-changes`, cookie, {
          change: "pause",
          occurred_on: "2026-09-20",
        }),
        objectiveParams(id),
      ),
  },
  {
    operationId: "listDeviationPatterns",
    call: (cookie) =>
      patterns.GET(req("GET", "/v1/deviation-patterns", cookie), undefined),
  },
  {
    operationId: "createDeviationPattern",
    call: (cookie) =>
      patterns.POST(
        req("POST", "/v1/deviation-patterns", cookie, { name: "itest" }),
        undefined,
      ),
  },
  {
    operationId: "listDeviations",
    call: (cookie) =>
      deviations.GET(
        req("GET", "/v1/deviations?from=2026-09-01&to=2026-09-30", cookie),
        undefined,
      ),
  },
  {
    operationId: "createDeviation",
    call: (cookie) =>
      deviations.POST(
        req("POST", "/v1/deviations", cookie, {
          objective_ids: ["00000000-0000-0000-0000-00000000dead"],
          local_date: "2026-09-16",
          tz: "UTC",
          kind: "chosen",
          what_happened: "w",
          reasoning: "r",
          minutes: 5,
        }),
        undefined,
      ),
  },
  {
    operationId: "listParkedIdeas",
    call: (cookie) =>
      ideas.GET(req("GET", "/v1/parked-ideas", cookie), undefined),
  },
  {
    operationId: "createParkedIdea",
    call: (cookie) =>
      ideas.POST(
        req("POST", "/v1/parked-ideas", cookie, {
          idea: "i",
          why: "w",
          caught_on: "2026-09-16",
        }),
        undefined,
      ),
  },
  {
    operationId: "createParkedIdeaVerdict",
    resource: async (user) => (await testIdea(user)).id,
    call: (cookie, id) =>
      verdicts.POST(
        req("POST", `/v1/parked-ideas/${id}/verdicts`, cookie, {
          verdict: "dropped",
          occurred_on: "2026-10-01",
        }),
        { params: Promise.resolve({ ideaId: id }) },
      ),
  },
  {
    operationId: "listReviews",
    resource: anObjective,
    call: (cookie, id) =>
      reviewsOf.GET(
        req("GET", `/v1/objectives/${id}/reviews`, cookie),
        objectiveParams(id),
      ),
  },
  {
    operationId: "startReview",
    resource: anObjective,
    call: (cookie, id) =>
      reviewsOf.POST(
        req("POST", `/v1/objectives/${id}/reviews`, cookie),
        objectiveParams(id),
      ),
  },
  {
    operationId: "getReview",
    resource: aReview,
    call: (cookie, id) =>
      review.GET(req("GET", `/v1/reviews/${id}`, cookie), reviewParams(id)),
  },
  {
    operationId: "updateReview",
    resource: aReview,
    call: (cookie, id) =>
      review.PATCH(
        req("PATCH", `/v1/reviews/${id}`, cookie, { review_summary: "x" }),
        reviewParams(id),
      ),
  },
  {
    operationId: "discardReview",
    resource: aReview,
    call: (cookie, id) =>
      review.DELETE(
        req("DELETE", `/v1/reviews/${id}`, cookie),
        reviewParams(id),
      ),
  },
];
