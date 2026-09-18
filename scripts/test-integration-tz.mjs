#!/usr/bin/env node
/**
 * Run the INTEGRATION suite once per timezone (NFR-12, kept half).
 *
 * These tests hit a real Postgres, so this is where the pg DATE parser bites —
 * a raw DATE returned as a Date at local midnight would slip a day under a
 * distant server zone. Running the same suite under four zones makes that a red
 * build. Every integration test here is date-sensitive, so all four zones run;
 * if a non-date-sensitive integration suite is added later, run only the
 * date-sensitive ones under all four and the rest under UTC.
 *
 *   TZ=UTC · Asia/Kolkata · Pacific/Kiritimati (UTC+14) · America/Los_Angeles (UTC-8)
 *
 * DATABASE_URL (and the rest of the config) must already be set — locally via
 * .env, in CI via the job env against the Postgres 18 service container.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ZONES = [
  "UTC",
  "Asia/Kolkata",
  "Pacific/Kiritimati",
  "America/Los_Angeles",
];

const vitest = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);
const config = fileURLToPath(
  new URL("../vitest.integration.config.ts", import.meta.url),
);

const started = Date.now();
for (const tz of ZONES) {
  console.log(`\n=== integration tests under TZ=${tz} ===`);
  const at = Date.now();
  const result = spawnSync(
    process.execPath,
    [vitest, "run", "--config", config],
    { stdio: "inherit", env: { ...process.env, TZ: tz } },
  );
  const secs = ((Date.now() - at) / 1000).toFixed(2);
  if (result.status !== 0) {
    console.error(
      `\n✗ FAILED under TZ=${tz} (after ${secs}s). This zone caught it.`,
    );
    process.exit(result.status ?? 1);
  }
  console.log(`✓ TZ=${tz} passed (${secs}s)`);
}

const total = ((Date.now() - started) / 1000).toFixed(2);
console.log(`\n✓ all ${ZONES.length} zones passed in ${total}s`);
