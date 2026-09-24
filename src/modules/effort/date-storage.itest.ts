import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { getConfig } from "@/config/env";
import { getPool, query } from "@/shared/db";
import { insertEffortEntry, type EffortEntryRow } from "@/modules/effort/repo";
import { getDayRows } from "@/modules/today/repo";

/**
 * NFR-12 (kept half) against a REAL Postgres — this is where the pg DATE parser
 * actually bites. The date a row is stored under must depend only on what the
 * client sent, never on:
 *   - the server's timezone (this file is run under four TZ values by
 *     scripts/test-integration-tz.mjs),
 *   - the database session timezone (asserted directly below), or
 *   - when the request arrived.
 *
 * Fixtures come from `npm run seed` (user, an objective created 2026-09-14 with
 * a fixed Mon–Fri segment covering 2026-09-18, a Friday). Slots are computed,
 * not seeded (W4-29). Run migrate + seed before this suite.
 */
const USER_ID = "00000000-0000-0000-0000-000000000001";
const OBJECTIVE_ID = "00000000-0000-0000-0000-0000000000a1";
const DATE = "2026-09-18"; // a Friday, covered by the seeded plan
const CLIENT_TZ = "Asia/Kolkata";
const NOTE = "itest: NFR-12 date-storage probe";

let inserted: EffortEntryRow;

async function deleteProbe(): Promise<void> {
  await query(
    "DELETE FROM effort_entry WHERE objective_id = $1 AND note = $2",
    [OBJECTIVE_ID, NOTE],
  );
}

describe("effort entry date storage (real Postgres)", () => {
  beforeAll(async () => {
    await deleteProbe(); // deterministic across the four per-timezone runs
    inserted = await insertEffortEntry(OBJECTIVE_ID, {
      local_date: DATE,
      tz: CLIENT_TZ,
      minutes: 60,
      note: NOTE,
    });
  });

  afterAll(async () => {
    await deleteProbe();
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
