import * as day from "@/app/v1/day/[date]/route";
import * as objectives from "@/app/v1/objectives/route";
import * as objective from "@/app/v1/objectives/[objectiveId]/route";
import * as schedule from "@/app/v1/objectives/[objectiveId]/schedule/route";
import * as effortEntries from "@/app/v1/objectives/[objectiveId]/effort-entries/route";
import * as session from "@/app/v1/session/route";
import * as entry from "@/app/v1/effort-entries/[entryId]/route";
import * as effortMonth from "@/app/v1/objectives/[objectiveId]/effort/route";
import {
  OBJECTIVE_BODY,
  testEntry,
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
];
