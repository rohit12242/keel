// PreToolUse hook for Bash.
//
// Refuses the commands that would undo Rohit's uncommitted work, bypass the
// pipeline, or change something that is his to change:
//
//   - pushing to main, or force-pushing anything   (contributing.md, D-09)
//   - --no-verify                                  (the checks are the point)
//   - git reset --hard / git clean / git checkout -- .   (his uncommitted files)
//   - installing a package                         (CLAUDE.md, dependencies)
//   - terraform apply / destroy                    (infrastructure is a human decision)
//   - shell writes into docs/build-log/            (same rule as guard-edit)
//   - rm -rf on anything above the repo
//
// Exit 0 allows; exit 2 with a reason on stderr refuses.

import { execSync } from "node:child_process";

const input = JSON.parse(await readStdin());
const cwd = input.cwd ?? process.cwd();
const cmd = String(input.tool_input?.command ?? "");
if (!cmd.trim()) process.exit(0);

const refuse = (why) => {
  process.stderr.write(`REFUSED: ${why}\n  command: ${cmd}\n`);
  process.exit(2);
};

const has = (re) => re.test(cmd);

// --- git push --------------------------------------------------------------
if (has(/\bgit\s+push\b/)) {
  if (has(/\bgit\s+push\b[^|&;]*(--force\b|-f\b|--force-with-lease\b)/)) {
    refuse(
      "Force-pushing rewrites history someone else (CI, a stacked branch) already saw. Rebase onto a new branch instead.",
    );
  }
  if (has(/\bgit\s+push\b[^|&;]*\b(main|master)\b/)) {
    refuse(
      "main is never pushed to directly (contributing.md). Push the story branch and open a PR.",
    );
  }
  // `git push` with no refspec pushes the current branch — refuse if that is main.
  if (!has(/\bgit\s+push\b[^|&;]*\s\S+\s+\S+/)) {
    try {
      const branch = execSync("git branch --show-current", {
        cwd,
        encoding: "utf8",
      }).trim();
      if (branch === "main" || branch === "master")
        refuse(
          "You are on main. Create a story branch (w4-07-<slug>) before pushing.",
        );
    } catch {
      /* not a git repo here; let it through */
    }
  }
}

if (has(/--no-verify\b/))
  refuse(
    "--no-verify skips the hooks that make the pipeline trustworthy. Fix the failing check instead.",
  );

// --- destructive git -------------------------------------------------------
if (has(/\bgit\s+reset\s+--hard\b/))
  refuse(
    "git reset --hard discards uncommitted work, including files Rohit has not committed yet. Use git stash or a new branch.",
  );
if (has(/\bgit\s+clean\b/))
  refuse(
    "git clean deletes untracked files, which may be Rohit's in-progress ADRs. Do not.",
  );
if (
  has(/\bgit\s+checkout\s+(--\s+)?\.(\s|$)/) ||
  has(/\bgit\s+restore\s+(--\s+)?\.(\s|$)/)
) {
  refuse(
    "Reverting the whole working tree throws away changes that are not yours. Revert named files only, and only ones this story touched.",
  );
}
if (has(/\bgit\s+(branch\s+-D|push\s+[^|&;]*--delete)\b/))
  refuse("Branches are deleted by Rohit after merge, not by the agent.");

// --- dependencies ----------------------------------------------------------
if (process.env.KEEL_ALLOW_DEPS !== "1") {
  const DEP_MSG =
    "Installing a package adds a dependency; that needs Rohit's approval first (CLAUDE.md). Name it and why, then stop.";
  // `npm install` / `npm i` with no package (restore node_modules) is fine.
  // Any package name, or a save flag, is an addition.
  const m = cmd.match(/\bnpm\s+(install|i|add)\b([^|&;]*)/);
  if (m) {
    const args = m[2].trim().split(/\s+/).filter(Boolean);
    const namesPackage = args.some((a) => !a.startsWith("-"));
    const saveFlag = args.some((a) =>
      /^(-D|-S|-g|-E|-O|--save(-dev|-optional|-exact)?|--global)$/.test(a),
    );
    if (m[1] === "add" || namesPackage || saveFlag) refuse(DEP_MSG);
  }
  if (has(/\b(pnpm|yarn|bun)\s+add\b/)) refuse(DEP_MSG);
}

// --- infrastructure --------------------------------------------------------
if (has(/\bterraform\s+(apply|destroy|import|state\s+rm)\b/)) {
  refuse(
    "Applying infrastructure changes is a human action (ADR-006). terraform plan is fine; report the plan in your handover.",
  );
}

// --- the build log, via the shell ------------------------------------------
if (
  has(/docs\/build-log\//) &&
  has(/(>|>>|\btee\b|\bsed\s+-i|\bmv\b|\bcp\b)/)
) {
  refuse(
    "docs/build-log/ is written by a human (CLAUDE.md). Do not write to it from the shell either.",
  );
}

// --- rm -rf on something outside the repo ----------------------------------
if (has(/\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+("?~|\/(\s|$)|\.\.)/)) {
  refuse("Recursive delete outside the repository. No.");
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
