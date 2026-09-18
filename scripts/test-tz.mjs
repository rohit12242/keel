#!/usr/bin/env node
/**
 * Run the unit suite once per timezone (NFR-12, kept half — W3-19).
 *
 * The date a row is stored under must depend ONLY on what the client sent, not
 * on the runtime's zone. The way we prove that in the pipeline is to run the
 * SAME tests under several TZ values and require identical results. A difference
 * between runs is the bug.
 *
 *   TZ=UTC                  baseline, and what the CI runner defaults to
 *   TZ=Asia/Kolkata         a half-hour offset — catches hour-only maths
 *   TZ=Pacific/Kiritimati   UTC+14, so local "today" is UTC "tomorrow"
 *   TZ=America/Los_Angeles  UTC-8, so local "today" is UTC "yesterday"
 *
 * This is ADR-003's unit-test stage run four times, not a new stage. Fail-fast:
 * the first zone that goes red stops the run and names itself.
 *
 * Node sets the process default zone from the TZ env var at startup, so each
 * child is spawned with TZ in its environment — never mutated in-process.
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
// Any extra args (e.g. a file filter) pass straight through to vitest.
const passthrough = process.argv.slice(2);

const started = Date.now();
for (const tz of ZONES) {
  console.log(`\n=== unit tests under TZ=${tz} ===`);
  const at = Date.now();
  const result = spawnSync(process.execPath, [vitest, "run", ...passthrough], {
    stdio: "inherit",
    env: { ...process.env, TZ: tz },
  });
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
