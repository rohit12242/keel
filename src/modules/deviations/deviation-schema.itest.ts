import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { getConfig } from "@/config/env";
import { getPool } from "@/shared/db";
import { testObjective, testUser, type TestUser } from "@/test/fixtures";

/**
 * I-02 step 13 — every constraint the deviations migration adds, proved by
 * the row it refuses. Each case writes in a transaction and rolls back.
 */
type PgError = { code?: string; constraint?: string };

let client: pg.Client;
let me: TestUser;
let them: TestUser;
let mine: string;
let theirs: string;

async function attempt(
  statements: { sql: string; params: unknown[] }[],
): Promise<PgError | undefined> {
  await client.query("BEGIN");
  try {
    for (const s of statements) await client.query(s.sql, s.params);
    return undefined;
  } catch (e) {
    return e as PgError;
  } finally {
    await client.query("ROLLBACK");
  }
}

const deviation = (
  id: string,
  userId: string,
  over: Record<string, unknown> = {},
) => {
  const row: Record<string, unknown> = {
    kind: "chosen",
    pattern_id: null,
    verdict: null,
    verdict_review_id: null,
    ...over,
  };
  // A chosen deviation has its reasoning and a drifted one none, unless the
  // case says otherwise.
  const reasoning =
    "reasoning" in over ? over.reasoning : row.kind === "chosen" ? "r" : null;
  return {
    sql: `INSERT INTO deviation
            (id, user_id, local_date, tz, kind, what_happened, reasoning,
             minutes, pattern_id, verdict, verdict_review_id)
          VALUES ($1, $2, '2026-09-16', 'UTC', $3, 'w', $7, 30, $4, $5, $6)`,
    params: [
      id,
      userId,
      row.kind,
      row.pattern_id,
      row.verdict,
      row.verdict_review_id,
      reasoning,
    ],
  };
};

const pattern = (id: string, userId: string, name: string) => ({
  sql: `INSERT INTO deviation_pattern (id, user_id, name) VALUES ($1, $2, $3)`,
  params: [id, userId, name],
});

describe("deviation schema (real Postgres)", () => {
  beforeAll(async () => {
    me = await testUser();
    them = await testUser();
    mine = (await testObjective(me)).id;
    theirs = (await testObjective(them)).id;
    client = new pg.Client({ connectionString: getConfig().databaseUrl });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
    await getPool().end();
  });

  it("accepts a deviation naming the user's own objective", async () => {
    const id = randomUUID();
    expect(
      await attempt([
        deviation(id, me.id),
        {
          sql: `INSERT INTO deviation_objective (deviation_id, objective_id, user_id)
                VALUES ($1, $2, $3)`,
          params: [id, mine, me.id],
        },
      ]),
    ).toBeUndefined();
  });

  it("refuses a deviation naming another user's objective (NFR-10)", async () => {
    const id = randomUUID();
    const err = await attempt([
      deviation(id, me.id),
      {
        sql: `INSERT INTO deviation_objective (deviation_id, objective_id, user_id)
              VALUES ($1, $2, $3)`,
        params: [id, theirs, me.id],
      },
    ]);
    expect(err?.code).toBe("23503");
    expect(err?.constraint).toBe("deviation_objective_objective_owned");
  });

  it("refuses a pairing that claims another user owns the deviation", async () => {
    const id = randomUUID();
    const err = await attempt([
      deviation(id, me.id),
      {
        sql: `INSERT INTO deviation_objective (deviation_id, objective_id, user_id)
              VALUES ($1, $2, $3)`,
        params: [id, theirs, them.id],
      },
    ]);
    expect(err?.code).toBe("23503");
    expect(err?.constraint).toBe("deviation_objective_deviation_owned");
  });

  it("refuses another user's pattern", async () => {
    const p = randomUUID();
    const err = await attempt([
      pattern(p, them.id, "Theirs"),
      deviation(randomUUID(), me.id, { pattern_id: p }),
    ]);
    expect(err?.code).toBe("23503");
    expect(err?.constraint).toBe("deviation_pattern_owned");
  });

  it("refuses a verdict without the review that gave it, and the reverse", async () => {
    for (const over of [
      { verdict: "worth_it" },
      { verdict_review_id: randomUUID() },
    ]) {
      const err = await attempt([deviation(randomUUID(), me.id, over)]);
      expect(err?.constraint).toBe("deviation_verdict_with_review");
    }
  });

  it("refuses a verdict on a drifted deviation (invariant 12)", async () => {
    const err = await attempt([
      deviation(randomUUID(), me.id, {
        kind: "drifted",
        verdict: "not_worth_it",
        verdict_review_id: randomUUID(),
      }),
    ]);
    expect(err?.constraint).toBe("deviation_verdict_only_chosen");
  });

  it("keeps reasoning on chosen deviations only (G5)", async () => {
    for (const over of [
      { kind: "drifted", reasoning: "r" },
      { kind: "chosen", reasoning: null },
    ]) {
      const err = await attempt([deviation(randomUUID(), me.id, over)]);
      expect(err?.constraint).toBe("deviation_reasoning_only_chosen");
    }
    expect(
      await attempt([deviation(randomUUID(), me.id, { kind: "drifted" })]),
    ).toBeUndefined();
  });

  it("refuses two patterns with one name, whatever the case", async () => {
    const err = await attempt([
      pattern(randomUUID(), me.id, "Planning instead of doing"),
      pattern(randomUUID(), me.id, "planning INSTEAD of doing"),
    ]);
    expect(err?.code).toBe("23505");
    expect(err?.constraint).toBe("deviation_pattern_user_name_key");
    // Another user may use the same name.
    expect(
      await attempt([
        pattern(randomUUID(), me.id, "Same name"),
        pattern(randomUUID(), them.id, "Same name"),
      ]),
    ).toBeUndefined();
  });
});
