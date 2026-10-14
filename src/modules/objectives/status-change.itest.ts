import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import * as route from "@/app/v1/objectives/[objectiveId]/status-changes/route";
import * as one from "@/app/v1/objectives/[objectiveId]/route";
import type { Objective } from "@/shared/contract";
import { testObjective, testUser, type TestUser } from "@/test/fixtures";

/**
 * I-02 step 11 — status changes through the route: every declared response,
 * and the history only ever grows.
 */
let me: TestUser;
let objectiveId: string;

const params = (id: string) => ({
  params: Promise.resolve({ objectiveId: id }),
});
const post = (body: unknown, id = objectiveId) =>
  route.POST(
    new Request(`http://keel.test/v1/objectives/${id}/status-changes`, {
      method: "POST",
      headers: { cookie: me.cookie },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    params(id),
  );
const history = async () =>
  (
    await query<{ change: string }>(
      `SELECT change FROM status_event WHERE objective_id = $1
       ORDER BY occurred_on, recorded_at`,
      [objectiveId],
    )
  ).rows.map((r) => r.change);

describe("status changes (real Postgres)", () => {
  beforeEach(async () => {
    me = await testUser();
    objectiveId = (await testObjective(me)).id; // created 2026-09-14
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("201s a pause and a resume, appending each, and the objective reads them", async () => {
    const paused = await post({
      change: "pause",
      occurred_on: "2026-09-20",
      reason: "Travelling.",
    });
    expect(paused.status).toBe(201);
    expect(await paused.json()).toEqual({
      occurred_on: "2026-09-20",
      change: "paused",
      reason: "Travelling.",
    });
    expect(
      (await post({ change: "resume", occurred_on: "2026-09-27" })).status,
    ).toBe(201);
    expect(await history()).toEqual(["created", "paused", "resumed"]);

    const res = await one.GET(
      new Request(`http://keel.test/v1/objectives/${objectiveId}`, {
        headers: { cookie: me.cookie },
      }),
      params(objectiveId),
    );
    const o = (await res.json()) as Objective;
    expect(o.status).toBe("active");
    expect(o.status_history.map((e) => e.change)).toEqual([
      "created",
      "paused",
      "resumed",
    ]);
  });

  it("409s a change that does not follow, and appends nothing", async () => {
    expect(
      (await post({ change: "resume", occurred_on: "2026-09-20" })).status,
    ).toBe(409);
    await post({ change: "end", occurred_on: "2026-09-20" });
    expect(
      (await post({ change: "pause", occurred_on: "2026-09-21" })).status,
    ).toBe(409);
    expect(await history()).toEqual(["created", "ended"]);
  });

  it("409s a change dated before the latest one", async () => {
    await post({ change: "pause", occurred_on: "2026-09-20" });
    const res = await post({ change: "resume", occurred_on: "2026-09-19" });
    expect(res.status).toBe(409);
    expect(await history()).toEqual(["created", "paused"]);
  });

  it("400s a bad body, naming the fields", async () => {
    expect((await post("{nope")).status).toBe(400);
    const res = await post({ change: "paused", occurred_on: "soon" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errors: { field: string }[] };
    expect(body.errors.map((e) => e.field)).toEqual(["change", "occurred_on"]);
  });

  it("404s an id that is not a UUID, or another user's objective", async () => {
    expect(
      (await post({ change: "pause", occurred_on: "2026-09-20" }, "nope"))
        .status,
    ).toBe(404);
    const theirs = await testObjective(await testUser());
    expect(
      (await post({ change: "pause", occurred_on: "2026-09-20" }, theirs.id))
        .status,
    ).toBe(404);
  });
});
