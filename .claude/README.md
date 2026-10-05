# `.claude/` — the harness

CLAUDE.md gives Claude the context; this folder enforces the rules that can be
enforced, and holds the agent that checks work before a human sees it.

The principle: **every time a PR needs rework, ask which file here should have
caught it, and change that file before the next change.** The harness
improves at merge time or not at all.

| Piece | What it does | Enforces |
|---|---|---|
| `settings.json` | Committed permissions and hook wiring. `allow` lets the agent run the checks and the git/gh commands a change needs without prompting; `deny` is the short list that no session may do. | D-09, W3-11 |
| `hooks/guard-edit.mjs` | Before any file edit: refuses `docs/build-log/` (human-written), `package.json` (dependencies need approval — `KEEL_ALLOW_DEPS=1` once one is approved), `.env*`, real `.tfvars`, editing an *existing* migration, and the hooks themselves. | CLAUDE.md working style, dependency rule, NFR-08/W3-11 |
| `hooks/guard-bash.mjs` | Before any shell command: refuses pushes to main and force pushes, `--no-verify`, `git reset --hard` / `git clean` / whole-tree revert (Rohit's uncommitted files), package installs, `terraform apply`, shell writes into the build log, recursive deletes above the repo. | contributing.md, ADR-006 |
| `hooks/stop-check.mjs` | When the agent tries to finish: if code changed, runs CI's cheap blocking stages (`format:check`, `lint`, `typecheck`, `test:tz`, `test:coverage`, `contract`) and sends the agent back on the first failure. Three attempts, then it must write a handover and stop. Docs-only sessions finish freely. | ADR-003 — a red build is found in the session, not on the PR |
| `agents/verifier.md` | Read-only. Checks finished work before a human sees it: runs the checks in CLAUDE.md, confirms the change does what was asked, and reports pass / fail / not run. Never fixes. | — |

## What is deliberately not here (yet)

- **Journey-test gates in the Stop hook.** ADR-007 names four journey tests; CI
  does not enforce them yet. Add to CI first, then mirror here. (Coverage is done:
  W5-06 put ADR-007's domain gate in CI, and the Stop hook now runs it too.)
- **A build stage in the Stop hook.** Too slow for a hook; CI stage 7 keeps it.

## Testing a hook by hand

```
printf '{"cwd":"%s","tool_name":"Edit","tool_input":{"file_path":"package.json"}}' "$PWD" \
  | node .claude/hooks/guard-edit.mjs; echo "exit $?"      # expect 2 and a reason
```
