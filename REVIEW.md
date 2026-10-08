# Review instructions

## Passes
Tag each finding with its pass:
- Bugs: logic errors, edge cases, regressions
- Security: unvalidated input, injection, missing auth, secrets in code or logs
- Spec: change matches the intent's `spec.md`; flag anything missing or extra
- Plan: the diff does what `plan.md`'s steps said, and only that; a step that quietly grew is a finding
- Design: follows the design principles in CLAUDE.md; flag layer violations, tight coupling, logic in the wrong place
- Tests: new behavior is tested; no test deleted or weakened

## Intent, spec and plan
One folder per intent, committed in the same PR:

```
docs/intents/<id>-<slug>/
  intent.md    why it exists, what changes for the user
  spec.md      what must be true when it is done
  plan.md      the ordered steps
```

Find them in the PR's changed files. If they are not there, the PR follows up an
earlier one — take the id from the branch name (`i-01-<slug>` is `I-01`) and read
them from the repository. Read all three before reviewing.

For platform work — CI, hooks, guards, the harness — **the ADR is the intent**, so
there is no `intent.md`; `spec.md` names the ADR instead. That is not a finding.

A code change with no spec and plan, in the PR or the repository, is an Important
Spec finding. Docs-only and CI-only PRs are exempt.

## The plan gate
`plan.md` must carry `Status: ACCEPTED <date>`. It is committed first and alone,
before any code commit — nothing is implemented without an accepted plan.

- No `Status: ACCEPTED` line → Important Plan finding.
- A code commit earlier than the plan commit → Important Plan finding.
- The plan changed in the same PR that implements it, with no re-acceptance → Important Plan finding.
- A missing section among _Files that change_, _Order of work_, _Risks_, _Proof_ → nit.

A plan that exists is not a plan that was agreed.

## Severity
Important = breaks behavior, leaks data, misses the spec, departs from the plan, or breaks a design principle. Style and naming are nits.
Report at most 5 nits; summarize the rest as a count.

## Out of scope
A finding that is real but outside this intent is **not** fixed here and **not**
added to the plan. Report it, and say it belongs in
`docs/intents/TRIAGE.md`. Sprint 02 grew from 26 stories to 32 by folding findings
into the work that found them.

## Skip
Generated files, lockfiles, anything CI already checks.

## Keel rules
<!-- Add one line when a review catches the same mistake twice -->
