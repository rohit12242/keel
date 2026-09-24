import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Integration tests (the .itest.ts files) — these hit a real Postgres (the
 * DATABASE_URL in the environment), which is where the pg DATE parser actually
 * bites (NFR-12). Kept separate from the unit config (which globs the .test.ts
 * files and touches no database) so the unit stage stays fast and DB-free.
 *
 * Run once per timezone by scripts/test-integration-tz.mjs; in CI, against a
 * Postgres 18 service container (ADR-003's integration stage).
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.itest.ts"],
    // Registers NFR-12's DATE-as-string parser for every suite, including ones
    // that build their own pg client and never import shared/db (W3-19).
    setupFiles: ["./vitest.integration.setup.ts"],
    // Real database: run files one at a time so they don't race on shared rows.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
