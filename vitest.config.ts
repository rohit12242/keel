import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Match the "@/*" -> "./src/*" alias from tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Domain unit tests run with no DOM, no server, no database (ADR-003
    // stage 6). Fast enough to run on every commit.
    environment: "node",
    include: ["src/**/*.test.ts"],
    // ADR-007: 100% on the pure domain blocks a merge; everything else is
    // reported, never gated. Off by default so `npm test` and `test:tz` stay
    // as fast as they were — `npm run test:coverage` turns it on (W5-06).
    coverage: {
      provider: "v8",
      // An untested domain file shows up at 0% instead of being left out.
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.itest.ts",
        // Type-only: no runtime code, so nothing to cover (ADR-007, W5-06
        // amendment). Re-justify this line if the file ever gains a value.
        "src/modules/today/domain/rows.ts",
        "src/modules/objectives/domain/rows.ts",
      ],
      reporter: ["text"],
      // No global threshold: only the domain blocks. All four metrics, because
      // a branch-only gate cannot see an exported function no test calls.
      thresholds: {
        "src/**/domain/**": {
          branches: 100,
          statements: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
