import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { Validator } from "@seriousme/openapi-schema-validator";
import { beforeAll, describe, expect, it } from "vitest";
import { AUTHORIZATION } from "@/test/authorization-table";

/**
 * The contract and the code cannot drift apart unnoticed (I-02). Read from
 * docs/keel-api.yaml:
 *
 * - every route handler under src/app/v1 (and /health) is an operation the
 *   contract declares — no undeclared endpoint;
 * - every declared operation has a handler, unless it is named below as not
 *   built yet;
 * - every operation with a handler that needs a session has a row in the
 *   authorisation table, so it is proven to 401 without one and 404 across
 *   users; an operation the contract makes public (`security: []`) has none.
 *
 * Each step that builds an operation removes it from NOT_YET_BUILT; the step
 * that builds the last one deletes the list.
 */
const NOT_YET_BUILT = new Set(["createExtension"]);

const METHODS = ["GET", "PUT", "POST", "PATCH", "DELETE"] as const;
const APP = join(process.cwd(), "src", "app");

type Operation = {
  operationId: string;
  method: string;
  /** The URL path as served: /v1/objectives/{objectiveId}, or /health. */
  path: string;
  isPublic: boolean;
};

/** /v1/objectives/{objectiveId} → src/app/v1/objectives/[objectiveId]/route.ts */
const routeFile = (path: string) =>
  join(
    APP,
    ...path
      .split("/")
      .filter(Boolean)
      .map((s) => s.replace(/^\{(.+)\}$/, "[$1]")),
    "route.ts",
  );

/** The inverse, for a route file found on disk. */
const pathOf = (file: string) =>
  "/" +
  relative(APP, file)
    .split(sep)
    .slice(0, -1)
    .map((s) => s.replace(/^\[(.+)\]$/, "{$1}"))
    .join("/");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? routeFiles(join(dir, e.name))
      : e.name === "route.ts"
        ? [join(dir, e.name)]
        : [],
  );
}

async function handlersIn(file: string): Promise<string[]> {
  const mod = (await import(file)) as Record<string, unknown>;
  return METHODS.filter((m) => typeof mod[m] === "function");
}

let operations: Operation[];

describe("the contract and the code agree", () => {
  beforeAll(async () => {
    const validator = new Validator();
    await validator.validate("docs/keel-api.yaml");
    const spec = validator.specification as {
      security?: unknown[];
      paths: Record<
        string,
        Record<string, { operationId: string; security?: unknown[] }> & {
          servers?: { url: string }[];
        }
      >;
    };
    operations = Object.entries(spec.paths).flatMap(([path, item]) => {
      // Every path is served under /v1 unless it names its own server.
      const prefix = item.servers?.[0]?.url.replace(/\/$/, "") ?? "/v1";
      return METHODS.filter((m) => item[m.toLowerCase()]).map((m) => {
        const op = item[m.toLowerCase()];
        const security = op.security ?? spec.security ?? [];
        return {
          operationId: op.operationId,
          method: m,
          path: `${prefix}${path}`,
          isPublic: security.length === 0,
        };
      });
    });
  });

  it("names no operation the contract lacks", () => {
    const declared = new Set(operations.map((o) => o.operationId));
    for (const id of NOT_YET_BUILT) expect(declared).toContain(id);
    for (const row of AUTHORIZATION)
      expect(declared).toContain(row.operationId);
  });

  it("serves no endpoint the contract does not declare", async () => {
    const declared = new Set(operations.map((o) => `${o.method} ${o.path}`));
    const files = [
      ...routeFiles(join(APP, "v1")),
      join(APP, "health", "route.ts"),
    ];
    for (const file of files) {
      for (const method of await handlersIn(file)) {
        expect(declared, `${method} ${pathOf(file)}`).toContain(
          `${method} ${pathOf(file)}`,
        );
      }
    }
  });

  it("has a handler for every operation built so far, and none for the rest", async () => {
    for (const op of operations) {
      const file = routeFile(op.path);
      const built =
        existsSync(file) && (await handlersIn(file)).includes(op.method);
      expect(built, op.operationId).toBe(!NOT_YET_BUILT.has(op.operationId));
    }
  });

  it("checks the session of every built operation that needs one, and of no public one", () => {
    const rows = new Set(AUTHORIZATION.map((r) => r.operationId));
    expect(rows.size, "an operation has two rows").toBe(AUTHORIZATION.length);
    for (const op of operations) {
      if (NOT_YET_BUILT.has(op.operationId)) continue;
      expect(rows.has(op.operationId), op.operationId).toBe(!op.isPublic);
    }
  });
});
