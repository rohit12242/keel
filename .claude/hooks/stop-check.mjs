// Stop hook.
//
// Runs when the agent is about to say "done". If this session changed code,
// the same cheap-and-blocking stages CI runs (ADR-003, stages 2–6) must pass
// *here*, or the agent is sent back to fix them. The point: a red build is
// discovered by the agent, in the session, not by Rohit on the PR an hour later.
//
// Stages, in CI's order (fail fast, fail cheap):
//   format:check → lint → typecheck → test:tz → contract
// Build (stage 7) and the integration job are left to CI — too slow for a hook.
//
// Loop guard: the agent gets three attempts per session. On the third failure
// it is told to stop fixing and write down what fails. Stop hooks that block
// forever are how a session burns a night's tokens on one lint error.
//
// Output contract: print {"decision":"block","reason":...} as JSON on stdout to
// send the agent back; print nothing and exit 0 to let it stop.

import { execSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAX_ATTEMPTS = 3;
const STAGES = ["format:check", "lint", "typecheck", "test:tz", "contract"];
const CODE_PATH =
  /^(src\/|migrations\/|scripts\/|docs\/keel-api\.yaml$|package\.json$|package-lock\.json$|tsconfig\.json$|eslint\.config\.mjs$|next\.config\.ts$|vitest\..*\.ts$|\.prettierrc$)/;

const input = JSON.parse(await readStdin());
const cwd = input.cwd ?? process.cwd();
const session = String(input.session_id ?? "nosession").replace(
  /[^a-zA-Z0-9_-]/g,
  "",
);
const stateDir = join(tmpdir(), "keel-stop-check");
const stateFile = join(stateDir, `${session}.json`);

// 1. Did this session touch code at all? Docs-only work stops freely.
const changed = changedPaths(cwd);
const codeChanged = changed.filter((p) => CODE_PATH.test(p));
if (codeChanged.length === 0) {
  clearState();
  process.exit(0);
}

// 2. Loop guard.
const attempts = readState().attempts ?? 0;
if (attempts >= MAX_ATTEMPTS) {
  clearState();
  process.exit(0); // the previous block already told the agent to stop and report
}

// 3. Run the stages, stop at the first failure.
for (const stage of STAGES) {
  const r = spawnSync("npm", ["run", "--silent", stage], {
    cwd,
    encoding: "utf8",
    timeout: 240_000,
  });
  if (r.status === 0) continue;

  const next = attempts + 1;
  writeState({ attempts: next });
  const tail = ((r.stdout ?? "") + "\n" + (r.stderr ?? ""))
    .trim()
    .split("\n")
    .slice(-40)
    .join("\n");
  const last = next >= MAX_ATTEMPTS;
  const reason =
    `Stop check: \`npm run ${stage}\` failed (attempt ${next} of ${MAX_ATTEMPTS}). ` +
    `Code changed in this session: ${codeChanged.slice(0, 8).join(", ")}${codeChanged.length > 8 ? ", …" : ""}.\n` +
    (last
      ? "This was the last attempt. Do NOT keep fixing. Write a short handover naming the failing stage, " +
        "the error, and what you tried, then stop. Rohit decides next."
      : "Fix it and finish again. (format failures: `npm run format`. Do not disable a rule to pass; " +
        "if a rule is wrong, say so in the handover.)") +
    "\n\n--- last 40 lines ---\n" +
    tail;
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

clearState();
process.exit(0);

// ---------------------------------------------------------------------------
function changedPaths(dir) {
  const out = new Set();
  try {
    // working tree + index, tracked and untracked
    execSync("git status --porcelain --untracked-files=all", {
      cwd: dir,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean)
      .forEach((l) =>
        out.add(
          l
            .slice(3)
            .trim()
            .replace(/^.* -> /, ""),
        ),
      );
    // commits on this branch that main does not have
    const base = execSync(
      "git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main",
      {
        cwd: dir,
        encoding: "utf8",
        shell: "/bin/sh",
      },
    ).trim();
    if (base) {
      execSync(`git diff --name-only ${base} HEAD`, {
        cwd: dir,
        encoding: "utf8",
      })
        .split("\n")
        .filter(Boolean)
        .forEach((p) => out.add(p));
    }
  } catch {
    /* not a git repo, or no main yet: treat as no code change */
  }
  return [...out];
}

function readState() {
  try {
    return existsSync(stateFile)
      ? JSON.parse(readFileSync(stateFile, "utf8"))
      : {};
  } catch {
    return {};
  }
}
function writeState(s) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(stateFile, JSON.stringify(s));
}
function clearState() {
  try {
    if (existsSync(stateFile)) unlinkSync(stateFile);
  } catch {
    /* ignore */
  }
}
function readStdin() {
  return new Promise((res) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => res(data || "{}"));
  });
}
