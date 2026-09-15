#!/usr/bin/env node
/**
 * Contract validation — ADR-003 stage 7 / W3-10.
 *
 * Two assertions, both blocking:
 *   (a) docs/keel-api.yaml is valid OpenAPI 3.1.
 *   (b) every operation declares at least one 4xx or 5xx response.
 *
 * (b) is the reason this check exists: it turns NFR-07 ("every endpoint has a
 * defined failure response") from an intention into a red build. A check that
 * only validated the schema would look green and guard nothing.
 *
 * No network: the validator bundles the OpenAPI schemas, so this runs in a
 * fork pull request with no secrets (ADR-003 / ADR-004).
 */
import { Validator } from "@seriousme/openapi-schema-validator";

const SPEC = "docs/keel-api.yaml";
const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];
const isFailureCode = (code) =>
  /^[45]\d\d$/.test(code) || /^[45]xx$/i.test(code);

const fail = (msg) => {
  console.error(`✗ contract: ${msg}`);
  process.exit(1);
};

const validator = new Validator();
const result = await validator.validate(SPEC);

// (a) valid OpenAPI 3.1
if (!result.valid) {
  const detail = JSON.stringify(result.errors, null, 2);
  fail(`${SPEC} is not valid OpenAPI.\n${detail}`);
}

const spec = validator.specification;
const version = String(spec.openapi ?? "");
if (!version.startsWith("3.1")) {
  fail(`expected OpenAPI 3.1.x, found "${version || "no openapi field"}".`);
}

// (b) every operation declares at least one 4xx/5xx response
const offenders = [];
let operationCount = 0;
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  for (const method of HTTP_METHODS) {
    const op = item?.[method];
    if (!op) continue;
    operationCount += 1;
    const codes = Object.keys(op.responses ?? {});
    if (!codes.some(isFailureCode)) {
      const id = op.operationId ? ` (${op.operationId})` : "";
      offenders.push(`${method.toUpperCase()} ${path}${id}`);
    }
  }
}

if (offenders.length > 0) {
  fail(
    `${offenders.length} operation(s) declare no 4xx/5xx response (NFR-07):\n` +
      offenders.map((o) => `  - ${o}`).join("\n"),
  );
}

console.log(
  `✓ contract: ${SPEC} is valid OpenAPI ${version}; ` +
    `all ${operationCount} operations declare a 4xx/5xx response.`,
);
