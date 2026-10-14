import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { getConfig } from "@/config/env";
import { getPool } from "@/shared/db";
import { testObjective, testUser, type TestUser } from "@/test/fixtures";

/**
 * I-02 step 17 — every constraint the parking-lot migration adds, proved by
 * the row it refuses. Each case writes in a transaction and rolls back.
 */
type PgError = { code?: string; constraint?: string };

let client: pg.Client;
let me: TestUser;
let them: TestUser;

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

const idea = (id: string, userId: string, lockedUntil = "2026-10-11") => ({
  sql: `INSERT INTO parked_idea (id, user_id, idea, why, caught_on, locked_until)
        VALUES ($1, $2, 'i', 'w', '2026-09-16', $3)`,
  params: [id, userId, lockedUntil],
});
const verdict = (ideaId: string, v: string) => ({
  sql: `INSERT INTO parked_idea_verdict (parked_idea_id, verdict, occurred_on)
        VALUES ($1, $2, '2026-10-12')`,
  params: [ideaId, v],
});
const startFrom = (objectiveId: string, ideaId: string) => ({
  sql: `UPDATE objective SET from_parked_idea_id = $2 WHERE id = $1`,
  params: [objectiveId, ideaId],
});

describe("parking-lot schema (real Postgres)", () => {
  beforeAll(async () => {
    me = await testUser();
    them = await testUser();
    client = new pg.Client({ connectionString: getConfig().databaseUrl });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
    await getPool().end();
  });

  it("refuses a lock that ends before the idea was caught", async () => {
    const err = await attempt([idea(randomUUID(), me.id, "2026-09-15")]);
    expect(err?.code).toBe("23514");
  });

  it("refuses a second taken verdict for one idea", async () => {
    const id = randomUUID();
    const err = await attempt([
      idea(id, me.id),
      verdict(id, "taken"),
      verdict(id, "taken"),
    ]);
    expect(err?.constraint).toBe("parked_idea_verdict_one_taken_idx");
  });

  it("allows verdicts to flip and flip back — the history only grows", async () => {
    const id = randomUUID();
    expect(
      await attempt([
        idea(id, me.id),
        verdict(id, "parked"),
        verdict(id, "dropped"),
        verdict(id, "parked"),
      ]),
    ).toBeUndefined();
  });

  it("refuses an objective started from another user's idea (NFR-10)", async () => {
    const mine = (await testObjective(me)).id;
    const theirIdea = randomUUID();
    const err = await attempt([
      idea(theirIdea, them.id),
      startFrom(mine, theirIdea),
    ]);
    expect(err?.constraint).toBe("objective_from_parked_idea_owned");
  });

  it("refuses two objectives from one idea", async () => {
    const one = (await testObjective(me)).id;
    const two = (await testObjective(me)).id;
    const id = randomUUID();
    const err = await attempt([
      idea(id, me.id),
      startFrom(one, id),
      startFrom(two, id),
    ]);
    expect(err?.constraint).toBe("objective_from_parked_idea_key");
  });
});
