#!/usr/bin/env node
/**
 * ADR-007's coverage gate (W5-06): the unit suite with coverage on, and the
 * thresholds in vitest.config.ts deciding the verdict.
 *
 * Only `src/**\/domain/**` is thresholded — 100% on branches, statements,
 * functions and lines. Every other file is in the report and never blocks.
 * vitest fails the run on a threshold miss; this wrapper exists so the failure
 * names the rule that was broken rather than a bare percentage.
 *
 * Runs once, under the runner's zone: the four-zone run (test:tz) is the
 * date-correctness check, this is the "every rule has a test" check.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitest = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);
// Any extra args (e.g. a file filter) pass straight through to vitest.
const passthrough = process.argv.slice(2);

const started = Date.now();
const result = spawnSync(
  process.execPath,
  [vitest, "run", "--coverage", ...passthrough],
  { stdio: "inherit" },
);
const secs = ((Date.now() - started) / 1000).toFixed(2);

if (result.status !== 0) {
  console.error(
    `\n✗ Coverage gate FAILED (after ${secs}s). Either a test failed (see above)` +
      `\n  or ADR-007's threshold was missed: src/**/domain/** must be at 100%` +
      `\n  branches, statements, functions and lines. An uncovered line` +
      `\n  above is a domain rule with no test — write the test, or delete the` +
      `\n  branch if it cannot happen. Never lower the threshold or add an ignore.`,
  );
  process.exit(result.status ?? 1);
}
console.log(`\n✓ Coverage gate passed (ADR-007) in ${secs}s`);
