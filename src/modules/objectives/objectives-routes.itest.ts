import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import * as list from "@/app/objectives/route";
import * as one from "@/app/objectives/[objectiveId]/route";
import * as schedule from "@/app/objectives/[objectiveId]/schedule/route";

/**
 * I-01 step 7: every response the contract declares for the four operations,
 * through the real route handlers against real Postgres (NFR-07: no
 * operation ships with only a happy path).
 *
 * Another user's objective is seeded with fixed ids, idempotently, so the
 * suite can run once per timezone against one database. It must 404 and must
 * never appear in a list (NFR-10).
 */
const OTHER_USER = "00000000-0000-0000-0000-00000000f001";
const OTHER_OBJECTIVE = "00000000-0000-0000-0000-00000000f0a1";

const BODY = {
  title: "itest: I-01 routes",
  why_now: "Every declared response, exercised.",
  success_criteria: "No happy path ships alone.",
  schedule: {
    mode: "fixed",
    planned_weekdays: [1, 2, 3, 4, 5],
    minutes_per_planned_day: 60,
  },
  starts_on: "2026-11-02",
  tz: "Asia/Kolkata",
  runs_for_days: 14,
  review_cadence: "weekly",
};

const URL_BASE = "http://keel.test";
const post = (body: unknown) =>
  list.POST(
    new Request(`${URL_BASE}/objectives`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const params = (objectiveId: string) => ({
  params: Promise.resolve({ objectiveId }),
});
const getOne = (id: string) =>
  one.GET(new Request(`${URL_BASE}/objectives/${id}`), params(id));
const getSchedule = (id: string, qs = "") =>
  schedule.GET(
    new Request(`${URL_BASE}/objectives/${id}/schedule${qs}`),
    params(id),
  );

async function problemOf(res: Response) {
  expect(res.headers.get("content-type")).toBe("application/problem+json");
  return (await res.json()) as {
    status: number;
    type: string;
    errors?: { field: string }[];
  };
}

describe("objectives routes (real Postgres)", () => {
  let created: string;

  beforeAll(async () => {
    await query(
      `INSERT INTO "user" (id, email, tz) VALUES ($1, 'other@keel.local', 'UTC')
       ON CONFLICT (id) DO NOTHING`,
      [OTHER_USER],
    );
    await query(
      `INSERT INTO objective (id, user_id, title, why_now, success_criteria, review_cadence)
       VALUES ($1, $2, 'Someone else''s', 'Not yours.', 'Never shown.', 'weekly')
       ON CONFLICT (id) DO NOTHING`,
      [OTHER_OBJECTIVE, OTHER_USER],
    );
    await query(
      `INSERT INTO plan_segment (objective_id, seq, schedule_mode, planned_weekdays,
         minutes_per_planned_day, start_date, end_date, reason)
       VALUES ($1, 0, 'fixed', 31, 60, '2026-11-02', '2026-11-15', 'Not yours.')
       ON CONFLICT (objective_id, seq) DO NOTHING`,
      [OTHER_OBJECTIVE],
    );
    // Invariant 16 holds for this fixture too.
    await query(
      `INSERT INTO status_event (objective_id, occurred_on, change)
       VALUES ($1, '2026-11-02', 'created')
       ON CONFLICT (objective_id) WHERE change = 'created' DO NOTHING`,
      [OTHER_OBJECTIVE],
    );

    const res = await post(BODY);
    expect(res.status).toBe(201);
    created = ((await res.json()) as { id: string }).id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  // --- POST /objectives ------------------------------------------------------

  it("201s with the objective, and 400s a body that is not JSON", async () => {
    const res = await getOne(created);
    expect(res.status).toBe(200);
    const bad = await post("{not json");
    expect(bad.status).toBe(400);
  });

  it("400s a field wrong on its own, naming it", async () => {
    const res = await post({ ...BODY, tz: "Mars/Olympus" });
    expect(res.status).toBe(400);
    expect((await problemOf(res)).errors?.map((e) => e.field)).toEqual(["tz"]);
  });

  it("422s a schedule that contradicts its mode", async () => {
    const res = await post({
      ...BODY,
      schedule: { ...BODY.schedule, days_per_week: 3 },
    });
    expect(res.status).toBe(422);
    expect((await problemOf(res)).type).toMatch(/schedule-mode-mismatch$/);
  });

  // --- GET /objectives -------------------------------------------------------

  it("lists the caller's objectives and never another user's", async () => {
    const res = await list.GET(
      new Request(`${URL_BASE}/objectives?status=active`),
    );
    expect(res.status).toBe(200);
    const ids = (
      (await res.json()) as { objectives: { id: string }[] }
    ).objectives.map((o) => o.id);
    expect(ids).toContain(created);
    expect(ids).not.toContain(OTHER_OBJECTIVE);
  });

  it("400s an unknown status filter", async () => {
    const res = await list.GET(
      new Request(`${URL_BASE}/objectives?status=created`),
    );
    expect(res.status).toBe(400);
    expect((await problemOf(res)).errors?.map((e) => e.field)).toEqual([
      "status",
    ]);
  });

  // --- GET /objectives/{id} and /schedule ------------------------------------

  it("404s another user's objective, not 403 (NFR-10)", async () => {
    expect((await getOne(OTHER_OBJECTIVE)).status).toBe(404);
    expect((await getSchedule(OTHER_OBJECTIVE)).status).toBe(404);
  });

  it("404s an id that is not a UUID, or names no row", async () => {
    expect((await getOne("not-a-uuid")).status).toBe(404);
    expect((await getSchedule("not-a-uuid")).status).toBe(404);
    const nobody = "00000000-0000-0000-0000-00000000dead";
    expect((await getOne(nobody)).status).toBe(404);
  });

  it("400s a schedule range with to before from, or a malformed date", async () => {
    const back = await getSchedule(created, "?from=2026-11-10&to=2026-11-03");
    expect(back.status).toBe(400);
    const bad = await getSchedule(created, "?from=10-11-2026");
    expect((await problemOf(bad)).errors?.map((e) => e.field)).toEqual([
      "from",
    ]);
  });

  it("200s the grid over the objective's span by default", async () => {
    const res = await getSchedule(created);
    expect(res.status).toBe(200);
    const grid = (await res.json()) as {
      from: string;
      to: string;
      days: unknown[];
    };
    expect([grid.from, grid.to, grid.days.length]).toEqual([
      "2026-11-02",
      "2026-11-15",
      14,
    ]);
  });
});
