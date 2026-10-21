import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getPool, query, type Queryable } from "@/shared/db";
import * as objectives from "@/app/v1/objectives/route";
import * as ideas from "@/app/v1/parked-ideas/route";
import * as verdicts from "@/app/v1/parked-ideas/[ideaId]/verdicts/route";
import {
  OBJECTIVE_BODY,
  testIdea,
  testObjective,
  testUser,
  type TestUser,
} from "@/test/fixtures";
import type { ParkedIdea } from "./domain/parking";

/**
 * I-02 step 20 — taking an idea is creating an objective from it: the
 * objective and the idea's `taken` verdict are written together, or neither.
 */
let failVerdictInsert = false;
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return {
    ...actual,
    withTransaction: <T>(fn: (tx: Queryable) => Promise<T>) =>
      actual.withTransaction((tx) =>
        fn({
          query: (text: string, params?: unknown[]) => {
            if (
              failVerdictInsert &&
              text.includes("INSERT INTO parked_idea_verdict")
            ) {
              throw new Error("forced: the taken verdict did not write");
            }
            return tx.query(text, params);
          },
        } as Queryable),
      ),
  };
});

let me: TestUser;

const take = (ideaId: string, title = "From an idea") =>
  objectives.POST(
    new Request("http://keel.test/v1/objectives", {
      method: "POST",
      headers: { cookie: me.cookie },
      body: JSON.stringify({
        ...OBJECTIVE_BODY,
        title,
        starts_on: "2026-10-12",
        from_parked_idea_id: ideaId,
      }),
    }),
    undefined,
  );
const ideaNow = async (id: string) =>
  (
    (await (
      await ideas.GET(
        new Request("http://keel.test/v1/parked-ideas", {
          headers: { cookie: me.cookie },
        }),
        undefined,
      )
    ).json()) as { ideas: ParkedIdea[] }
  ).ideas.find((i) => i.id === id) as ParkedIdea;

describe("taking an idea (real Postgres)", () => {
  beforeEach(async () => {
    me = await testUser();
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("201s the objective, and the idea is taken, dated the day it starts", async () => {
    const idea = await testIdea(me);
    const res = await take(idea.id);
    expect(res.status).toBe(201);
    const objective = (await res.json()) as {
      id: string;
      from_parking_lot: boolean;
    };
    expect(objective.from_parking_lot).toBe(true);
    expect(await ideaNow(idea.id)).toMatchObject({
      verdict: "taken",
      became_objective_id: objective.id,
      decided_early: false,
    });
    const taken = await query<{ occurred_on: string }>(
      `SELECT to_char(occurred_on, 'YYYY-MM-DD') AS occurred_on
       FROM parked_idea_verdict WHERE parked_idea_id = $1 AND verdict = 'taken'`,
      [idea.id],
    );
    expect(taken.rows[0].occurred_on).toBe("2026-10-12");
  });

  it("allows an early take of a locked idea, and says it was early", async () => {
    await testObjective(me, { starts_on: "2026-10-01", runs_for_days: 60 });
    const locked = await testIdea(me, "2026-10-05"); // locked until 2026-11-29
    expect((await take(locked.id)).status).toBe(201);
    expect(await ideaNow(locked.id)).toMatchObject({
      verdict: "taken",
      decided_early: true,
    });
  });

  it("422s an idea already taken, dropped, or someone else's — and writes no objective", async () => {
    const taken = await testIdea(me);
    await take(taken.id, "first");
    expect((await take(taken.id, "second")).status).toBe(422);

    const dropped = await testIdea(me);
    await verdicts.POST(
      new Request(`http://keel.test/v1/parked-ideas/${dropped.id}/verdicts`, {
        method: "POST",
        headers: { cookie: me.cookie },
        body: JSON.stringify({
          verdict: "dropped",
          occurred_on: "2026-10-01",
          note: "Not for me.",
        }),
      }),
      { params: Promise.resolve({ ideaId: dropped.id }) },
    );
    expect((await take(dropped.id, "from dropped")).status).toBe(422);

    const theirs = await testIdea(await testUser());
    expect((await take(theirs.id, "from theirs")).status).toBe(422);

    const written = await query(
      `SELECT title FROM objective WHERE user_id = $1 ORDER BY title`,
      [me.id],
    );
    expect(written.rows.map((r) => r.title)).toEqual(["first"]);
  });

  it("writes the objective and the taken verdict together, or neither", async () => {
    const idea = await testIdea(me);
    failVerdictInsert = true;
    try {
      expect((await take(idea.id, "all-or-nothing probe")).status).toBe(503);
    } finally {
      failVerdictInsert = false;
    }
    const left = await query(
      `SELECT 1 FROM objective WHERE user_id = $1 AND title = $2`,
      [me.id, "all-or-nothing probe"],
    );
    expect(left.rowCount).toBe(0);
    expect((await ideaNow(idea.id)).verdict).toBe("parked");
  });
});
