import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { getConfig } from "@/config/env";

/**
 * I-02 step 2 — the user row as sign-in needs it (ADR-002, ERD *User*).
 *
 * Each case writes in a transaction and rolls back, so nothing is left behind.
 */
type PgError = { code?: string; constraint?: string };

let client: pg.Client;

describe("user schema (real Postgres)", () => {
  beforeAll(async () => {
    client = new pg.Client({ connectionString: getConfig().databaseUrl });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it("has no column that could hold a password", async () => {
    const res = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM information_schema.columns
       WHERE table_name = 'user' AND column_name = 'password_hash'`,
    );
    expect(Number(res.rows[0].n)).toBe(0);
  });

  it("refuses two users with the same provider subject", async () => {
    const subject = `itest|${randomUUID()}`;
    const insert = `INSERT INTO "user" (email, tz, idp_subject) VALUES ($1, 'UTC', $2)`;
    await client.query("BEGIN");
    let err: PgError | undefined;
    try {
      await client.query(insert, [`itest-${randomUUID()}@keel.test`, subject]);
      await client.query(insert, [`itest-${randomUUID()}@keel.test`, subject]);
    } catch (e) {
      err = e as PgError;
    }
    await client.query("ROLLBACK");
    expect(err?.code).toBe("23505");
    expect(err?.constraint).toBe("user_idp_subject_key");
  });

  it("allows more than one row without a subject (written before sign-in)", async () => {
    const insert = `INSERT INTO "user" (email, tz) VALUES ($1, 'UTC')`;
    await client.query("BEGIN");
    try {
      await client.query(insert, [`itest-${randomUUID()}@keel.test`]);
      await client.query(insert, [`itest-${randomUUID()}@keel.test`]);
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
