import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { getConfig } from "@/config/env";
import { getPool, query } from "@/shared/db";
import { insertEffortEntry, type EffortEntryRow } from "@/modules/effort/repo";
import { getDayRows } from "@/modules/today/repo";
import { testObjective, testUser } from "@/test/fixtures";

/**
 * NFR-12 (kept half) against a REAL Postgres — this is where the pg DATE parser
 * actually bites. The date a row is stored under must depend only on what the
 * client sent, never on:
 *   - the server's timezone (this file is run under four TZ values by
 *     scripts/test-integration-tz.mjs),
 *   - the database session timezone (asserted directly below), or
 *   - when the request arrived.
 *
 * The suite makes its own user and objective (created 2026-09-14, a fixed
 * Mon–Fri segment covering 2026-09-18, a Friday), new on every run, so the
 * four per-timezone runs never see each other's probe.
 */
const DATE = "2026-09-18"; // a Friday, covered by the plan
const CLIENT_TZ = "Asia/Kolkata";
const NOTE = "itest: NFR-12 date-storage probe";

let USER_ID: string;
let OBJECTIVE_ID: string;
let inserted: EffortEntryRow;

describe("effort entry date storage (real Postgres)", () => {
  beforeAll(async () => {
    const user = await testUser();
    USER_ID = user.id;
    OBJECTIVE_ID = (await testObjective(user)).id;
    inserted = await insertEffortEntry(getPool(), OBJECTIVE_ID, {
      local_date: DATE,
      tz: CLIENT_TZ,
      occurred_at_local: "09:00",
      minutes: 60,
      note: NOTE,
    });
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("returns a real DATE column as a 'YYYY-MM-DD' string, not a Date", async () => {
    const res = await query<{ d: unknown }>("SELECT '2026-09-18'::date AS d");
    expect(typeof res.rows[0].d).toBe("string");
    expect(res.rows[0].d).toBe("2026-09-18");
  });

  it("stores the entry under the client's local_date and returns it unchanged", () => {
    expect(inserted.local_date).toBe(DATE);
    expect(typeof inserted.local_date).toBe("string");
  });

  it("reads the entry back on the same date via the /day query", async () => {
    const rows = await getDayRows(USER_ID, DATE);
    const obj = rows.find((r) => r.id === OBJECTIVE_ID);
    expect(obj).toBeDefined();
    const mine = obj?.entries.find((e) => e.note === NOTE);
    expect(mine?.local_date).toBe(DATE);
  });

  it("selects by local_date, not a timestamp range (absent on adjacent days)", async () => {
    for (const other of ["2026-09-17", "2026-09-19"]) {
      const rows = await getDayRows(USER_ID, other);
      const obj = rows.find((r) => r.id === OBJECTIVE_ID);
      const present = (obj?.entries ?? []).some((e) => e.note === NOTE);
      expect(present).toBe(false);
    }
  });

  it("is unaffected by the database session timezone", async () => {
    const client = new pg.Client({
      connectionString: getConfig().databaseUrl,
    });
    await client.connect();
    try {
      for (const zone of ["Pacific/Kiritimati", "America/Los_Angeles"]) {
        await client.query(`SET TIME ZONE '${zone}'`);
        const res = await client.query<{ s: string; raw: unknown }>(
          `SELECT to_char(local_date, 'YYYY-MM-DD') AS s, local_date AS raw
             FROM effort_entry WHERE id = $1`,
          [inserted.id],
        );
        expect(res.rows[0].s).toBe(DATE);
        // raw DATE comes back as the same string (the parser guard), not a Date
        // shifted by the session zone.
        expect(res.rows[0].raw).toBe(DATE);
      }
    } finally {
      await client.end();
    }
  });
});
