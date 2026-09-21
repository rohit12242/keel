---
description: Run one sprint story through the harness — brief, readiness check, implementation, checks, review, pull request.
argument-hint: W4-07
---

Implement Keel story **$ARGUMENTS** end to end, through the harness. Follow the
steps in order; do not skip the review because the checks passed.

## 0. Ground rules (CLAUDE.md applies in full)

- The story brief is `../Keel_doc/stories/$ARGUMENTS.md`. If it does not exist,
  stop and say so — Rohit exports briefs from the sprint sheet.
- Work on a branch named `<story id lowercased>-<short-slug>`, e.g. `w4-07-post-objectives`,
  created from up-to-date `main` (or from the base branch the brief names, for a
  stacked story).
- Every commit ends with `Story: $ARGUMENTS`. Conventional Commits, scope = module.
- Never touch `docs/build-log/`. Never add a dependency the brief has not
  pre-approved. Never push to main. The hooks enforce these; do not argue with them.
- When you need a decision that the ADRs, contract, ERD and brief do not settle,
  **stop and name it** rather than picking silently. Two or three such questions
  at the start cost minutes; a guess costs a rewrite.

## 1. Read

Read the brief, then CLAUDE.md, then only the artifacts the story points at:
the contract operations, ERD invariants, gaps, ADRs and the epic section of
`docs/backlog.md`. Read the most recent handover in `docs/build-log/` if one
exists, for the conventions the last batch settled.

## 2. Readiness

Use the **spec-checker** subagent on the brief. If it returns `NOT READY`, stop
and report its verdict. If `READY WITH QUESTIONS`, ask Rohit the questions and
wait — unless the brief's Assumptions section already answers them, in which
case proceed and say which assumption you are relying on.

## 3. Implement

Smallest change that makes the Output column true, in the shape CLAUDE.md's
architecture rule demands: rules in `domain/` as pure functions with tests,
SQL in `repo.ts`, one service function per use case, the route handler doing
HTTP only. Contract first if an endpoint changes: edit `docs/keel-api.yaml` in
the same commit as the route. Write the failure-path tests before the happy
path — NFR-07 is where generated code usually comes up short.

Commit in small, explained steps. The commit body says why.

## 4. Checks

Run, in this order and fix at the first failure:
`npm run format:check` → `npm run lint` → `npm run typecheck` →
`npm run test:tz` → `npm run contract`. If the story touches the database,
also `npm run test:integration` with the local Postgres up. The Stop hook runs
the first five again before you are allowed to finish; do not disable a rule
to pass one.

## 5. Review

Use the **reviewer** subagent with the brief path and the branch name. Read its
handover. Fix every `blocks` finding and re-run step 4. For `should fix`
findings, fix them if they are inside the story's scope; otherwise leave them
in the handover as they are. Do not edit the reviewer's "Choices the
implementer made" list to make yourself look better — that list is the point.

## 6. Pull request

Push the branch and open the PR with `gh pr create`. Title: the commit summary
of the main commit. Body: the PR template's Story and What-this-changes
sections filled in, then the reviewer's handover verbatim beneath a
`## Handover` heading. Tick only the review-gate boxes that are literally true;
leave clause 2 (explain unprompted) unticked — that one is Rohit's.

## 7. Finish

Reply with: the PR URL, the verdict line, the number of findings by severity,
and the "Choices … not specified" list copied out, because that is what Rohit
triages at merge time. Nothing else.
