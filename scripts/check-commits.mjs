#!/usr/bin/env node
/**
 * Commit message lint — ADR-003 stage 8 / W3-10.
 *
 * Enforces the CLAUDE.md convention on every commit a pull request adds:
 *   - Conventional Commits subject: <type>(<scope>)?: <summary>
 *     type ∈ feat|fix|docs|refactor|test|chore
 *   - an `Intent: I-nn` footer, the link between the intent and the commits that
 *     deliver it. `Story: W<week>-<nn>` is the historical form and stays valid so
 *     the commits made before Sprint 03 keep passing.
 *
 * No dependency: shells out to git and checks with regexes. Runs on
 * pull_request, so it needs the PR's commit range.
 *
 * Range resolution (first that applies):
 *   1. argv[2] as "<base>..<head>"
 *   2. BASE_SHA / HEAD_SHA env (set by the workflow from the PR event)
 *   3. fallback: the single HEAD commit
 */
import { execSync } from "node:child_process";

const TYPES = ["feat", "fix", "docs", "refactor", "test", "chore"];
const SUBJECT_RE = new RegExp(
  `^(${TYPES.join("|")})(\\([a-z0-9,\\- ]+\\))?!?: .+`,
);
const FOOTER_RE = /^(Intent:\s*I-\d+|Story:\s*W\d+-\d+)\b/m;

const git = (args) => execSync(`git ${args}`, { encoding: "utf8" }).trim();

function resolveRange() {
  if (process.argv[2]) return process.argv[2];
  const { BASE_SHA, HEAD_SHA } = process.env;
  if (BASE_SHA && HEAD_SHA) return `${BASE_SHA}..${HEAD_SHA}`;
  return "HEAD~0..HEAD";
}

const range = resolveRange();
const shas = git(`rev-list --no-merges ${range}`).split("\n").filter(Boolean);

if (shas.length === 0) {
  console.log(`✓ commits: nothing to check in ${range}.`);
  process.exit(0);
}

const problems = [];
for (const sha of shas) {
  const body = execSync(`git show -s --format=%B ${sha}`, { encoding: "utf8" });
  const subject = body.split("\n", 1)[0];
  const short = `${sha.slice(0, 8)} "${subject}"`;

  if (!SUBJECT_RE.test(subject)) {
    problems.push(
      `${short}\n    subject is not Conventional Commits ` +
        `(<type>(scope)?: summary; type ∈ ${TYPES.join("|")}).`,
    );
  }
  if (!FOOTER_RE.test(body)) {
    problems.push(
      `${short}\n    missing an "Intent: I-nn" footer ` +
        `(or the historical "Story: W<week>-<nn>").`,
    );
  }
}

if (problems.length > 0) {
  console.error("✗ commits: convention violations:\n" + problems.join("\n"));
  process.exit(1);
}

console.log(
  `✓ commits: ${shas.length} commit(s) in ${range} follow the convention.`,
);
