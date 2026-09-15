import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Domain unit tests run with no DOM, no server, no database (ADR-003
    // stage 6). Fast enough to run on every commit.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
