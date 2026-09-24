# `.claude/` — the harness

Everything in this folder exists to make a delegated story succeed on the first
pass without Rohit watching, and to make the review a structured report rather
than a diff. CLAUDE.md says the rules; this folder enforces the ones that can be
enforced and gives the agents a fixed shape for the rest.

The principle: **every time a PR needs rework, ask which file here should have
caught it, and change that file before delegating the next story.** The harness
improves at merge time or not at all.

| Piece | What it does | Enforces |
|---|---|---|
| `settings.json` | Committed permissions and hook wiring. `allow` lets the agent run the checks and the git/gh commands a story needs without prompting; `deny` is the short list that no session may do. | D-09, W3-11 |
| `hooks/guard-edit.mjs` | Before any file edit: refuses `docs/build-log/` (human-written), `package.json` (dependencies need approval — `KEEL_ALLOW_DEPS=1` when a brief pre-approves one), `.env*`, real `.tfvars`, editing an *existing* migration, and the hooks themselves. | CLAUDE.md working style, dependency rule, NFR-08/W3-11 |
| `hooks/guard-bash.mjs` | Before any shell command: refuses pushes to main and force pushes, `--no-verify`, `git reset --hard` / `git clean` / whole-tree revert (Rohit's uncommitted files), package installs, `terraform apply`, shell writes into the build log, recursive deletes above the repo. | contributing.md, ADR-006 |
| `hooks/stop-check.mjs` | When the agent tries to finish: if code changed, runs CI's cheap blocking stages (`format:check`, `lint`, `typecheck`, `test:tz`, `contract`) and sends the agent back on the first failure. Three attempts, then it must write a handover and stop. Docs-only sessions finish freely. | ADR-003 — a red build is found in the session, not on the PR |
| `agents/spec-checker.md` | Read-only. Runs the Definition of Ready over a story brief before any code exists and returns READY / READY WITH QUESTIONS / NOT READY. | definition-of-done.md, DoR clauses 1–6 |
| `agents/reviewer.md` | Read-only. Reviews the finished branch against the brief's Output column, the contract, the NFR questions, the architecture rule, scope and tests. Produces the handover report — the same shape as the W3-12…16 handover, minus the pre-written review-gate answer. | NFR-03/07/09/10/11/12, ADR-001, ADR-007 |
| `commands/story.md` | `/story W4-07` — the whole pipeline for one story: read brief → spec-checker → implement → checks → reviewer → PR with the handover in the body. | all of the above, in order |

Story briefs live outside the repo, in `../Keel_doc/stories/`, one file per
story, exported from the sprint sheet by `Keel_doc/tools/export-stories.py`.
The lower half of each brief (pre-approved dependencies, assumptions, base
branch, scope notes) is Rohit's and survives re-export.

## The one clause the harness must not satisfy

Definition of Done clause 2 — *you can explain it unprompted, and name one thing
you would change* — is the clause that decides whether this is learning or
outsourcing. The reviewer therefore gives **evidence pointers** for the review
gate, never the answer. If a handover starts answering the gate for you, that is
a regression in the harness, not a convenience.

## What is deliberately not here (yet)

- **A batch runner.** Once briefs are files and `/story` works for one story,
  running several in parallel is `git worktree add` per story plus
  `claude -p "/story W4-07"` per worktree. Worth adding when a sprint has three
  or more stories that touch different modules — E-02 onward.
- **Coverage and journey-test gates in the Stop hook.** ADR-007 decided them
  today; CI does not enforce them yet either. Add to CI first, then mirror here.
- **A build stage in the Stop hook.** Too slow for a hook; CI stage 7 keeps it.

## Testing a hook by hand

```
printf '{"cwd":"%s","tool_name":"Edit","tool_input":{"file_path":"package.json"}}' "$PWD" \
  | node .claude/hooks/guard-edit.mjs; echo "exit $?"      # expect 2 and a reason
```
