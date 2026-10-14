import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPool, query } from "@/shared/db";
import type { Day } from "@/shared/contract";
import * as day from "@/app/v1/day/[date]/route";
import * as deviations from "@/app/v1/deviations/route";
import { testObjective, testUser, type TestUser } from "@/test/fixtures";

/**
 * I-02 step 16 — Today's `last_deviation`: the caller's most recent deviation
 * on or before the day, inside Today's one query (NFR-03).
 */
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return { ...actual, query: vi.fn(actual.query) };
});

let me: TestUser;

const today = async (date: string, who = me): Promise<Day> => {
  const res = await day.GET(
    new Request(`http://keel.test/v1/day/${date}`, {
      headers: { cookie: who.cookie },
    }),
    { params: Promise.resolve({ date }) },
  );
  expect(res.status).toBe(200);
  return (await res.json()) as Day;
};

const record = async (
  objectiveId: string,
  local_date: string,
  what: string,
) => {
  const res = await deviations.POST(
    new Request("http://keel.test/v1/deviations", {
      method: "POST",
      headers: { cookie: me.cookie },
      body: JSON.stringify({
        objective_ids: [objectiveId],
        local_date,
        tz: "Asia/Kolkata",
        kind: "drifted",
        what_happened: what,
        reasoning: "r",
        minutes: 15,
      }),
    }),
    undefined,
  );
  expect(res.status).toBe(201);
};

describe("Today's last deviation (real Postgres)", () => {
  beforeAll(async () => {
    me = await testUser();
    const o = (await testObjective(me)).id;
    await record(o, "2026-09-15", "earlier");
    await record(o, "2026-09-17", "later");
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("is the most recent on or before the day, in the same one query", async () => {
    vi.mocked(query).mockClear();
    const d = await today("2026-09-16");
    expect(vi.mocked(query)).toHaveBeenCalledTimes(1);
    expect(d.last_deviation?.what_happened).toBe("earlier");
    expect((await today("2026-09-17")).last_deviation?.what_happened).toBe(
      "later",
    );
  });

  it("is null before any deviation, and for someone else", async () => {
    expect((await today("2026-09-14")).last_deviation).toBeNull();
    expect(
      (await today("2026-09-20", await testUser())).last_deviation,
    ).toBeNull();
  });
});
