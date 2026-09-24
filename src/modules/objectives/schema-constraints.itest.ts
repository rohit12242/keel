import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { getConfig } from "@/config/env";
import { configureDbDateParsing } from "@/shared/db-types";

/**
 * W4-10 — every constraint the migration adds, proved by violating it.
 *
 * A migration that runs cleanly proves nothing: it proves the SQL parses. These
 * tests write the row the constraint is supposed to refuse and assert the
 * refusal, plus the one thing the backfill claims (ERD invariant 16).
 *
 * Each case runs in its own transaction and rolls back, so the seeded database
 * is unchanged. `SET CONSTRAINTS ALL IMMEDIATE` makes the DEFERRABLE contiguity
 * trigger fire at the statement instead of at COMMIT, so a rolled-back
 * transaction still sees it.
 *
 * Fixtures are `npm run seed`'s: one objective with segment 0 (seq 0, fixed,
 * 2026-09-14 … 2026-10-11). Run migrate + seed before this suite.
 */
const OBJECTIVE_ID = "00000000-0000-0000-0000-0000000000a1";
const ADJACENT = "2026-10-12"; // the day after segment 0 ends — contiguous
const AFTER_A_GAP = "2026-10-13"; // one day later — leaves 10-12 unplanned

type PgError = { code?: string; constraint?: string; message?: string };

let client: pg.Client;

/** Run one statement in a doomed transaction; return the error, if any. */
async function attempt(
  sql: string,
  params: readonly unknown[] = [],
): Promise<PgError | undefined> {
  await client.query("BEGIN");
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");
  let err: PgError | undefined;
  try {
    await client.query(sql, params as unknown[]);
  } catch (e) {
    err = e as PgError;
  }
  await client.query("ROLLBACK");
  return err;
}

/** A second segment on the seeded objective. Contiguous unless `start` says otherwise. */
function insertSegment(
  columns: string,
  values: string,
  start = ADJACENT,
): { sql: string; params: unknown[] } {
  return {
    sql: `INSERT INTO plan_segment
            (objective_id, seq, schedule_mode, ${columns},
             minutes_per_planned_day, start_date, end_date, reason)
          VALUES ($1, $2, $3, ${values}, $4, $5, '2026-10-18', 'W4-10 itest')`,
    params: [OBJECTIVE_ID, 1, "fixed", 120, start],
  };
}

describe("W4-10 schema constraints (real Postgres)", () => {
  beforeAll(async () => {
    // This suite talks to pg directly rather than through shared/db, so the
    // DATE-as-string parser is not registered for it (NFR-12, W3-19). Without
    // this, occurred_on comes back as a JS Date at LOCAL midnight — under
    // TZ=Asia/Kolkata that is 2026-09-13T18:30Z, the off-by-one itself.
    configureDbDateParsing();
    client = new pg.Client({ connectionString: getConfig().databaseUrl });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  // --- the constraints this migration adds, each proved by a violation -------

  it("refuses a segment that starts after a gap (invariant 4, contiguity)", async () => {
    const { sql, params } = insertSegment(
      "planned_weekdays",
      "31",
      AFTER_A_GAP,
    );
    const err = await attempt(sql, params);
    expect(err?.code).toBe("23514"); // check_violation, raised by the trigger
    expect(err?.message).toContain("not contiguous");
  });

  it("refuses days_per_week outside 1–7", async () => {
    for (const days of [0, 8]) {
      const err = await attempt(
        `INSERT INTO plan_segment
           (objective_id, seq, schedule_mode, days_per_week,
            minutes_per_planned_day, start_date, end_date, reason)
         VALUES ($1, 1, 'flexible', $2, 120, $3, '2026-10-18', 'W4-10 itest')`,
        [OBJECTIVE_ID, days, ADJACENT],
      );
      expect(err?.constraint, `days_per_week = ${days}`).toBe(
        "plan_segment_days_per_week",
      );
    }
  });

  it("refuses a planned_weekdays bitmask outside 1–127", async () => {
    for (const mask of [0, 128]) {
      const { sql, params } = insertSegment("planned_weekdays", String(mask));
      const err = await attempt(sql, params);
      expect(err?.constraint, `bitmask = ${mask}`).toBe(
        "plan_segment_planned_weekdays",
      );
    }
  });

  it("refuses minutes_per_planned_day of zero", async () => {
    const err = await attempt(
      `INSERT INTO plan_segment
         (objective_id, seq, schedule_mode, planned_weekdays,
          minutes_per_planned_day, start_date, end_date, reason)
       VALUES ($1, 1, 'fixed', 31, 0, $2, '2026-10-18', 'W4-10 itest')`,
      [OBJECTIVE_ID, ADJACENT],
    );
    expect(err?.constraint).toBe("plan_segment_minutes_positive");
  });

  it("refuses a negative seq", async () => {
    const err = await attempt(
      `INSERT INTO plan_segment
         (objective_id, seq, schedule_mode, planned_weekdays,
          minutes_per_planned_day, start_date, end_date, reason)
       VALUES ($1, -1, 'fixed', 31, 120, $2, '2026-10-18', 'W4-10 itest')`,
      [OBJECTIVE_ID, ADJACENT],
    );
    expect(err?.constraint).toBe("plan_segment_seq_non_negative");
  });

  it("refuses a second 'created' event for one objective (invariant 16)", async () => {
    const err = await attempt(
      `INSERT INTO status_event (objective_id, occurred_on, change)
       VALUES ($1, '2026-09-20', 'created')`,
      [OBJECTIVE_ID],
    );
    expect(err?.code).toBe("23505"); // unique_violation
    expect(err?.constraint).toBe("status_event_one_created_idx");
  });

  it("refuses a status change that is not in the enum", async () => {
    const err = await attempt(
      `INSERT INTO status_event (objective_id, occurred_on, change)
       VALUES ($1, '2026-09-20', 'extended')`,
      [OBJECTIVE_ID],
    );
    // 'extended' is deliberately not a status change: an extension is a plan
    // segment (ERD status_event).
    expect(err?.code).toBe("22P02"); // invalid_text_representation
  });

  it("refuses a status event for an objective that does not exist", async () => {
    const err = await attempt(
      `INSERT INTO status_event (objective_id, occurred_on, change)
       VALUES ('00000000-0000-0000-0000-00000000dead', '2026-09-20', 'paused')`,
    );
    expect(err?.code).toBe("23503"); // foreign_key_violation
  });

  // --- what the migration claims --------------------------------------------

  it("gave every objective exactly one 'created' event (invariant 16)", async () => {
    const res = await client.query<{ objectives: string; wrong: string }>(
      `SELECT count(*) AS objectives,
              count(*) FILTER (
                WHERE (SELECT count(*) FROM status_event e
                       WHERE e.objective_id = o.id AND e.change = 'created') <> 1
              ) AS wrong
       FROM objective o`,
    );
    expect(Number(res.rows[0].objectives)).toBeGreaterThan(0);
    expect(Number(res.rows[0].wrong)).toBe(0);
  });

  it("dated the backfilled event from segment 0's start", async () => {
    const res = await client.query<{ occurred_on: unknown; start: unknown }>(
      `SELECT e.occurred_on, s.start_date AS start
       FROM status_event e
       JOIN plan_segment s ON s.objective_id = e.objective_id AND s.seq = 0
       WHERE e.objective_id = $1 AND e.change = 'created'`,
      [OBJECTIVE_ID],
    );
    expect(res.rows[0].occurred_on).toBe(res.rows[0].start);
    // A DATE comes back as a 'YYYY-MM-DD' string, never a JS Date (NFR-12).
    expect(typeof res.rows[0].occurred_on).toBe("string");
  });

  it("accepts a contiguous segment, so the trigger is not refusing everything", async () => {
    const { sql, params } = insertSegment("planned_weekdays", "31", ADJACENT);
    expect(await attempt(sql, params)).toBeUndefined();
  });

  it("left plan_slot and objective.status in place (expand only, ADR-004)", async () => {
    const res = await client.query<{ slots: string; status_columns: string }>(
      `SELECT (SELECT count(*) FROM plan_slot) AS slots,
              (SELECT count(*) FROM information_schema.columns
               WHERE table_name = 'objective' AND column_name = 'status') AS status_columns`,
    );
    expect(Number(res.rows[0].slots)).toBeGreaterThan(0);
    expect(Number(res.rows[0].status_columns)).toBe(1);
  });
});
