#!/usr/bin/env node
/**
 * Seed one user, one objective with one fixed weekday segment, and that
 * segment's generated slots (W3-12). Idempotent: safe to run repeatedly.
 *
 * Build/ops script — reads the environment directly and imports the pure
 * domain slot generator so the seed and the app agree on how slots are made.
 */
import { existsSync } from "node:fs";
import pg from "pg";
import { weekdaysToBitmask } from "../src/modules/objectives/domain/weekdays.ts";
import { configureDbDateParsing } from "../src/shared/db-types.ts";

// NFR-12: register the DATE-as-string parser before any query (the seed only
// writes dates today, but this keeps every entry point consistent).
configureDbDateParsing();

if (existsSync(".env")) process.loadEnvFile(".env");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("seed: DATABASE_URL is not set (see .env / .env.example).");
  process.exit(1);
}

// Must match DEFAULT_SEED_USER_ID in src/config/env.ts.
const USER_ID =
  process.env.SEED_USER_ID?.trim() || "00000000-0000-0000-0000-000000000001";
const OBJECTIVE_ID = "00000000-0000-0000-0000-0000000000a1";
const SEGMENT_ID = "00000000-0000-0000-0000-0000000000b1";

const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon–Fri
const MINUTES = 120;
const START = "2026-09-14"; // Monday
const END = "2026-10-11"; // Sunday, four weeks later

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("BEGIN");

  await client.query(
    `INSERT INTO "user" (id, email, tz) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [USER_ID, "founder@keel.local", "Asia/Kolkata"],
  );

  await client.query(
    `INSERT INTO objective
       (id, user_id, title, why_now, success_criteria, review_cadence)
     VALUES ($1, $2, $3, $4, $5, 'weekly')
     ON CONFLICT (id) DO NOTHING`,
    [
      OBJECTIVE_ID,
      USER_ID,
      "Ship Keel",
      "The record only matters if it is kept from day one.",
      "Today renders real effort against a real plan.",
    ],
  );

  // W4-10: an objective without a `created` status event has no status at all
  // (ERD invariant 16, ADR-008). The migration backfills existing rows; a seed
  // that creates an objective has to write one too, or it produces data that
  // violates the invariant this schema just introduced. There is no status
  // column (dropped by W4-30): this event IS the objective's status.
  // Idempotent against status_event_one_created_idx, the partial unique index.
  await client.query(
    `INSERT INTO status_event (objective_id, occurred_on, change)
     VALUES ($1, $2, 'created')
     ON CONFLICT (objective_id) WHERE change = 'created' DO NOTHING`,
    [OBJECTIVE_ID, START],
  );

  await client.query(
    `INSERT INTO plan_segment
       (id, objective_id, seq, schedule_mode, planned_weekdays,
        minutes_per_planned_day, start_date, end_date, reason)
     VALUES ($1, $2, 0, 'fixed', $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      SEGMENT_ID,
      OBJECTIVE_ID,
      weekdaysToBitmask(WEEKDAYS),
      MINUTES,
      START,
      END,
      "Segment 0 — the original plan.",
    ],
  );

  // No slots to seed: they are computed from the segment and the status events
  // on every read (ADR-008), and there is no table to put them in (W4-30).

  await client.query("COMMIT");
  console.log(
    `seed: user ${USER_ID}, objective "Ship Keel" (created ${START}), 1 segment (${START}..${END}). Slots are computed, not seeded.`,
  );
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
