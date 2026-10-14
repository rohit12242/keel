import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPool, query, type Queryable } from "@/shared/db";
import * as route from "@/app/v1/parked-ideas/route";
import { testObjective, testUser, type TestUser } from "@/test/fixtures";
import type { ParkedIdea } from "./domain/parking";

/**
 * I-02 step 18 — parking an idea and the parking lot, through the route. The
 * caller's objective is fixed Mon–Fri, 2026-09-14 … 2026-10-11.
 *
 * `withTransaction` is wrapped so one case can make the verdict insert fail
 * after the idea insert ran, and see that neither is left behind.
 */
let failVerdictInsert = false;
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return {
    ...actual,
    query: vi.fn(actual.query),
    withTransaction: <T>(fn: (tx: Queryable) => Promise<T>) =>
      actual.withTransaction((tx) =>
        fn({
          query: (text: string, params?: unknown[]) => {
            if (
              failVerdictInsert &&
              text.includes("INSERT INTO parked_idea_verdict")
            ) {
              throw new Error("forced: the verdict did not write");
            }
            return tx.query(text, params);
          },
        } as Queryable),
      ),
  };
});

let me: TestUser;

const park = (body: unknown, who = me) =>
  route.POST(
    new Request("http://keel.test/v1/parked-ideas", {
      method: "POST",
      headers: { cookie: who.cookie },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    undefined,
  );
const list = async (who = me) =>
  (
    (await (
      await route.GET(
        new Request("http://keel.test/v1/parked-ideas", {
          headers: { cookie: who.cookie },
        }),
        undefined,
      )
    ).json()) as { ideas: ParkedIdea[] }
  ).ideas;

describe("parking an idea (real Postgres)", () => {
  beforeAll(async () => {
    me = await testUser();
    await testObjective(me);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("201s an idea locked until the running objective ends, with its first verdict", async () => {
    const res = await park({
      idea: "Write a book",
      why: "It keeps coming back.",
      caught_on: "2026-09-16",
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      idea: "Write a book",
      caught_on: "2026-09-16",
      locked_until: "2026-10-11",
      verdict: "parked",
      note: null,
      became_objective_id: null,
      taken_early: false,
    });
  });

  it("does not lock an idea caught when nothing was running", async () => {
    const res = await park({
      idea: "Later",
      why: "w",
      caught_on: "2026-09-01",
    });
    expect(await res.json()).toMatchObject({
      locked_until: "2026-09-01",
      locked: false,
    });
  });

  it("lists the caller's ideas, newest caught first, in one query", async () => {
    vi.mocked(query).mockClear();
    const ideas = await list();
    expect(vi.mocked(query)).toHaveBeenCalledTimes(1);
    expect(ideas.map((i) => i.caught_on)).toEqual(["2026-09-16", "2026-09-01"]);
    expect(await list(await testUser())).toEqual([]);
  });

  it("400s a body that is not JSON or not an idea", async () => {
    expect((await park("{nope")).status).toBe(400);
    expect((await park({ idea: "", why: "w", caught_on: "x" })).status).toBe(
      400,
    );
  });

  it("parks the idea and its first verdict together, or neither", async () => {
    failVerdictInsert = true;
    try {
      const res = await park({
        idea: "all-or-nothing probe",
        why: "w",
        caught_on: "2026-09-16",
      });
      expect(res.status).toBe(503);
    } finally {
      failVerdictInsert = false;
    }
    const left = await query(
      `SELECT 1 FROM parked_idea WHERE user_id = $1 AND idea = $2`,
      [me.id, "all-or-nothing probe"],
    );
    expect(left.rowCount).toBe(0);
  });
});
