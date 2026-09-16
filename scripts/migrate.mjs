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
import { runner } from "node-pg-migrate";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
