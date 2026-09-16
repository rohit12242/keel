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
  },
});
