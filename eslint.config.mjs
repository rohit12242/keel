import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ADR-001 import boundary (ADR-003 stage 4).
  // A domain function takes values and returns values. It may import nothing
  // that speaks HTTP or SQL, no route handler, and no repository. This is the
  // rule that makes ADR-001 an architecture rather than a naming convention.
  // W3-10 runs the same lint in CI; here it fails the local `npm run lint`.
  {
    files: ["src/**/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app", "@/app/*", "**/app", "**/app/*"],
              message:
                "domain/ may not import a route handler (ADR-001: the domain is pure).",
            },
            {
              group: ["**/repo", "**/repo.*", "@/modules/*/repo"],
              message:
                "domain/ may not import a repository (ADR-001: repo.ts is the only file with SQL).",
            },
            {
              group: ["@/config", "@/config/*"],
              message:
                "domain/ may not import config (it reads the environment). Take config values as arguments (ADR-001 / ADR-004).",
            },
            {
              group: [
                "pg",
                "postgres",
                "kysely",
                "drizzle-orm",
                "next",
                "next/*",
                "http",
                "https",
                "node:http",
                "node:https",
                "node:sqlite",
                "undici",
                "axios",
                "node-fetch",
              ],
              message:
                "domain/ may not import a package that speaks HTTP or SQL (ADR-001).",
            },
          ],
        },
      ],
    },
  },

  // W3-11 / ADR-004: environment variables are read in exactly one place,
  // src/config/env.ts, which validates them and hands the rest of the app
  // typed values. Nothing else reads process.env directly.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/config/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Read environment variables only in src/config/env.ts (W3-11 / ADR-004); take config as values elsewhere.",
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
