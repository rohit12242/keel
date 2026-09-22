# ADR-003 — Pipeline stages and what gates a merge

**Decisions:** S1-A, S1-C · **Story:** W3-07 · **Status:** Decided · **Date:** 2026-09-15

## Context

D-09 chose short-lived branches with a pull request that cannot merge until checks
pass. That decision is only as good as the word "checks" — which nothing has
defined until now.

Two constraints shape it. The repository is **public**, so anyone can open a pull
request from a fork. And there is one developer, so every check has to justify
itself against the only scarce thing here: the seconds between pushing and knowing.

## Decision

**Nine stages on every pull request, ordered cheapest-and-most-likely-to-fail
first. Eight block the merge. One is advisory.**

| # | Stage | Blocks? | Why it is here |
|---|---|---|---|
| 1 | Install dependencies (cached) | yes | — |
| 2 | Format check | **yes** | Fails most often, costs seconds. Fail fast, fail cheap. |
| 3 | Lint | **yes** | Includes the import-boundary rule below. |
| 4 | **Domain import boundary** | **yes** | `domain/` may import nothing. Without this, ADR-001 is a naming convention. |
| 5 | Typecheck | **yes** | — |
| 6 | Unit tests — domain only, **run once per timezone** | **yes** | No database, no server. Run under UTC, Asia/Kolkata (half-hour offset), Pacific/Kiritimati (UTC+14) and America/Los_Angeles (UTC-8); a difference between zones is a date bug (NFR-12, kept half — W3-19). Four runs, not four stages. Still seconds. |
| 7 | **Contract validation** | **yes** | `keel-api.yaml` parses as OpenAPI 3.1, **and** every operation declares at least one 4xx/5xx response. NFR-07 as an assertion rather than an intention. |
| 8 | Integration tests | **yes** | Against a Postgres service container, not a real database. |
| 9 | Build | **yes** | — |
| — | Dependency audit | **advisory** | Reports, does not block. See below. |

**On merge to `main`:** the same nine, then deploy. An increment that is not
deployed is not done.

<!-- DRIFT (noted W3-19, unreconciled): this table and the built pipeline
     disagree. `.github/workflows/ci.yml` has 8 blocking steps and labels unit
     tests "Stage 5"; this table numbers them 6 and lists 9 stages, including a
     separate "domain import boundary" (folded into lint in ci.yml) and
     "integration tests" (stage 8, not yet built). Reconcile the numbering and
     the stage list against ci.yml when this ADR next changes. -->

## Three checks that are specific to Keel

Generic pipelines have lint, test and build. These three are the ones that enforce
decisions this project actually made, and they are the reason this ADR is longer
than "run the tests".

**The import boundary (stage 4).** ADR-001's entire architecture is one rule:
`domain/` imports nothing. A rule nobody checks survives about three weeks. This
turns it into a red build.

**Contract validation (stage 7).** Two assertions: the spec is valid OpenAPI 3.1,
and no operation ships with only a happy path. The second is a twelve-line script
over the parsed spec. NFR-07 stops being a promise the moment it is a check.

**Migration guard (stage 8, added in E-02).** Fail the build if a migration adds a
column whose name matches `total_`, `count_`, `_sum`, `adherence`, `streak`.
NFR-09 says no aggregate is ever stored. This is a crude guard, not a proof — it
catches the honest mistake at 11pm, not a determined one. Worth having anyway,
and worth knowing what it does not do.

## Why the dependency audit does not block

It is the one check whose failures are not caused by the commit being reviewed.
An advisory appears upstream overnight and suddenly an unrelated pull request is
red. That teaches you that red builds are sometimes noise — and once that is
learned, every red build is negotiable.

**A blocking check must fail only because of the change in front of it.** The
audit reports into the pull request and gets triaged deliberately, not in the
moment you are trying to merge something else.

## Time budget

**Target: under five minutes from push to green on a pull request.**

This is the number that makes the rest of the document honest. A pipeline nobody
waits for is a pipeline that gets bypassed, and the first sign of trouble is
finding yourself pushing directly rather than waiting.

Measures if it drifts over, in this order: cache more aggressively, run
independent stages in parallel, split integration tests so only affected suites
run. **Removing a check is the last resort, not the first.**

**If a check has to go, the first one out is:**
_(W3-07's review gate — record your answer here before ticking the story)_

## Because the repository is public

- Workflows run on `pull_request`, **not** `pull_request_target`. Fork pull
  requests therefore get no secrets, which is correct — a fork's code must never
  run with credentials.
- Every stage above works without secrets. Integration tests use a service
  container, not a real database. This is a design constraint, not a coincidence:
  the pipeline was chosen so a stranger's pull request can be fully verified.
- Require approval before workflows run for first-time contributors.
- Deployment runs only on `main`, where secrets are available and the code has
  already been reviewed.

## Other decisions made here

- **Concurrency:** in-progress runs for the same branch are cancelled when a new
  commit arrives. One developer pushing fixes should not queue behind themselves.
- **Node version:** one — 26, per D-02. No matrix. A matrix tests a compatibility
  question Keel does not have.
- **Commit message lint:** runs on pull request, blocking. The convention in
  `CLAUDE.md` is worth nothing unenforced, and the `Story: W3-xx` footer is how
  the sprint sheet and the repository stay connected.
- **Nothing runs on every local save.** Local hooks are bypassable and do not
  survive a new machine. The pipeline is the enforcement layer.

## Deferred, deliberately

| | Lands in |
|---|---|
| End-to-end smoke test against the deployed environment | E-03, once Today exists |
| Accessibility scan — contrast in both themes, keyboard walk | E-06, with NFR-13 |
| Performance check against a year of rows | E-05 |
| Coverage threshold | pending D-08's revisit in W3-23 |

## Consequences

**Good**

- "Checks pass" now has a definition, so D-09's merge gate can actually be
  configured in W3-10.
- Three architectural decisions — ADR-001's boundary, NFR-07's failure paths,
  NFR-09's no-aggregates rule — become build failures rather than good intentions.
- A public repository can accept a stranger's pull request and verify it fully
  without trusting it with anything.

**Costs accepted**

- Nine stages is more than a one-person project strictly needs, and the five-minute
  budget will be under pressure by E-05.
- The migration guard will produce false positives on a legitimately named column.
  The fix is to rename the column or document the exception, not to delete the
  guard.

## Revisit when

- The pull-request pipeline passes five minutes and caching and parallelism have
  already been tried.
- D-08's revisit settles whether a coverage threshold joins the blocking set.
- The first outside pull request arrives — which will test the fork assumptions
  above for real.
