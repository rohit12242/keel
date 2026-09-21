// PreToolUse hook for Edit | Write | MultiEdit.
//
// Turns four prose rules from CLAUDE.md into refusals the agent hits *before*
// the edit happens, instead of you noticing on the PR:
//
//   1. docs/build-log/ is written by a human.            (CLAUDE.md, Working style)
//   2. Dependencies need approval.                       (CLAUDE.md, "Ask before adding")
//   3. Secrets never enter the repository.               (W3-11)
//   4. An existing migration is applied; write a new one. (node-pg-migrate)
//   5. The agent does not edit its own guardrails.
//
// Contract: read the tool call as JSON on stdin; exit 0 to allow, exit 2 with a
// reason on stderr to refuse (the reason is shown to the agent).
// Escape hatch for (2): start Claude Code with KEEL_ALLOW_DEPS=1 for a story
// whose brief pre-approves a dependency.

import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

const input = JSON.parse(await readStdin());
const cwd = input.cwd ?? process.cwd();
const toolName = input.tool_name ?? "";
const rawPath = input.tool_input?.file_path ?? "";
if (!rawPath) process.exit(0);

const path = relative(cwd, resolve(cwd, rawPath)).replaceAll("\\", "/");

const refuse = (why) => {
  process.stderr.write(`REFUSED (${toolName} ${path}): ${why}\n`);
  process.exit(2);
};

if (path.startsWith("docs/build-log/")) {
  refuse(
    "The build log is written by a human, in his own words (CLAUDE.md, Working style). " +
      "Leave it alone. If something belongs in the log, say so in your handover.",
  );
}

if (
  /^(package\.json|package-lock\.json)$/.test(path) &&
  process.env.KEEL_ALLOW_DEPS !== "1"
) {
  refuse(
    "Dependencies need Rohit's approval before they are added (CLAUDE.md: 'Ask before adding any " +
      "runtime dependency'). Stop, name the package and why the standard library or existing " +
      "dependencies do not cover it, and wait. If the story brief already pre-approves it, " +
      "Claude Code must be started with KEEL_ALLOW_DEPS=1.",
  );
}

if (/^\.env(\..+)?$/.test(path) && path !== ".env.example") {
  refuse(
    "Secrets never enter the repository (W3-11). Add the variable name to .env.example and docs/configuration.md instead.",
  );
}

if (/^infra\/.*\.tfvars$/.test(path) && !path.endsWith(".tfvars.example")) {
  refuse(
    "terraform.tfvars holds real values and is gitignored. Edit terraform.tfvars.example instead.",
  );
}

if (path.startsWith("migrations/") && existsSync(resolve(cwd, path))) {
  refuse(
    "This migration already exists and may have been applied. Migrations are append-only: " +
      "write a new one (npm run migrate creates the timestamp) rather than editing this file.",
  );
}

if (path.startsWith(".claude/hooks/") || path === ".claude/settings.json") {
  refuse(
    "The harness is not edited by the agent it constrains. Propose the change to Rohit in your handover.",
  );
}

process.exit(0);

function readStdin() {
  return new Promise((res) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => res(data || "{}"));
  });
}
