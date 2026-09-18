#!/usr/bin/env node
/**
 * Run node-pg-migrate against DATABASE_URL (W3-12).
 *
 *   npm run migrate         → apply all pending migrations
 *   npm run migrate:down    → roll back the most recent one
 *
 * A thin wrapper (rather than the bare CLI) so it loads .env the same way the
 * app does. This is a build/ops script, not app code, so it reads the
 * environment directly.
 */
import pg from "pg";
import { runner } from "node-pg-migrate";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// NFR-12: DATE columns come back as 'YYYY-MM-DD' strings, never a JS Date at
// local midnight (the off-by-one). pg's type registry is process-global, so
// this covers node-pg-migrate's own connection too. Inlined here rather than
// importing src/shared/db-types.ts because the migrate container ships only
// this script and the migrations — no src/. Keep in step with that module.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

if (existsSync(".env")) process.loadEnvFile(".env");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("migrate: DATABASE_URL is not set (see .env / .env.example).");
  process.exit(1);
}

const direction = process.argv[2] === "down" ? "down" : "up";
const dir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
);

await runner({
  databaseUrl,
  dir,
  direction,
  count: direction === "down" ? 1 : Infinity,
  migrationsTable: "pgmigrations",
  verbose: true,
});
