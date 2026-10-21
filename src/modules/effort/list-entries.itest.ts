import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool } from "@/shared/db";
import type { EffortEntry, Objective } from "@/shared/contract";
import * as route from "@/app/v1/objectives/[objectiveId]/effort-entries/route";
import * as one from "@/app/v1/objectives/[objectiveId]/route";
import {
  testEntry,
  testObjective,
  testUser,
  type TestUser,
} from "@/test/fixtures";

/**
 * I-03 step 14 — an objective's entries over a range, with their times
 * (G18), every declared response; and the objective's last day logged. The
 * objective is fixed Mon–Fri, 2026-09-14 … 2026-10-11.
 */
let me: TestUser;
let objectiveId: string;

const params = (id: string) => ({
  params: Promise.resolve({ objectiveId: id }),
});
const list = (query: string, id = objectiveId) =>
  route.GET(
    new Request(`http://keel.test/v1/objectives/${id}/effort-entries${query}`, {
      headers: { cookie: me.cookie },
    }),
    params(id),
  );
const read = async (id = objectiveId) =>
  (await (
    await one.GET(
      new Request(`http://keel.test/v1/objectives/${id}`, {
        headers: { cookie: me.cookie },
      }),
      params(id),
    )
  ).json()) as Objective;

describe("an objective's entries over a range (real Postgres)", () => {
  beforeAll(async () => {
    me = await testUser();
    objectiveId = (await testObjective(me)).id;
    await testEntry(objectiveId, {
      local_date: "2026-09-16",
      occurred_at_local: "14:00",
      note: "afternoon",
    });
    await testEntry(objectiveId, {
      local_date: "2026-09-16",
      occurred_at_local: "09:20",
      note: "morning",
    });
    await testEntry(objectiveId, {
      local_date: "2026-09-19",
      note: "Saturday",
    });
    await testEntry(objectiveId, {
      local_date: "2026-09-22",
      note: "next week",
    });
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("200s the range's entries in time order, each with its start and extra", async () => {
    const res = await list("?from=2026-09-14&to=2026-09-20");
    expect(res.status).toBe(200);
    const { entries } = (await res.json()) as { entries: EffortEntry[] };
    expect(
      entries.map((e) => [e.local_date, e.occurred_at_local, e.note, e.extra]),
    ).toEqual([
      ["2026-09-16", "09:20", "morning", false],
      ["2026-09-16", "14:00", "afternoon", false],
      ["2026-09-19", "09:00", "Saturday", true],
    ]);
  });

  it("reads one day as a range of one", async () => {
    const res = await list("?from=2026-09-22&to=2026-09-22");
    const { entries } = (await res.json()) as { entries: EffortEntry[] };
    expect(entries.map((e) => e.note)).toEqual(["next week"]);
  });

  it("gives the objective the last day anything was logged, or null", async () => {
    expect((await read()).last_logged_on).toBe("2026-09-22");
    const empty = (await testObjective(me)).id;
    expect((await read(empty)).last_logged_on).toBeNull();
  });

  it("400s a missing, malformed or reversed range", async () => {
    expect((await list("")).status).toBe(400);
    expect((await list("?from=2026-09-14")).status).toBe(400);
    expect((await list("?from=soon&to=2026-09-20")).status).toBe(400);
    expect((await list("?from=2026-09-20&to=2026-09-14")).status).toBe(400);
  });

  it("404s an id that is not a UUID, or another user's objective", async () => {
    expect((await list("?from=2026-09-14&to=2026-09-20", "nope")).status).toBe(
      404,
    );
    const theirs = (await testObjective(await testUser())).id;
    expect((await list("?from=2026-09-14&to=2026-09-20", theirs)).status).toBe(
      404,
    );
  });
});
