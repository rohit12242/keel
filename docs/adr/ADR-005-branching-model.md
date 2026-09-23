# ADR-005 — Branching model

**Decision:** D-09 (elaborates) · **Status:** Decided · **Date:** 2026-09-15

## Context

When a staging environment was under consideration, the natural next thought was a
`staging` branch to go with it. Staging has since moved to future scope (ADR-004
R3), but the branching question is independent of it and will recur the moment
staging returns. This record settles it in advance.

## Decision

**Trunk-based. One long-lived branch: `main`.**

- Short-lived branches off `main`, merged back through a pull request.
- No `develop`, no `staging`, no `release/*` branches.
- Environments are deployment targets, not branches.

## Why not a staging branch

**1. It breaks build-once.** ADR-004 decided one artifact per merge: the thing
deployed is the thing the pipeline tested. With environment branches, each
environment builds from its own branch — two builds from two commits. **You would
test one artifact and ship another.** This becomes sharper, not softer, when
staging returns: the artifact an agent approves must be the one promoted.

**2. Merge-back drift.** `staging → main` accumulates divergence, cherry-picks and
"which branch is ahead" confusion. The bookkeeping is invisible until it is
expensive.

**3. Hotfixes need an exception.** Every environment-branch model has one: does an
urgent fix go to `main` first or `staging` first? Exceptions are where a solo
project's conventions rot.

**4. It doubles the ceremony and adds no check.** A second pull request from
`staging` to `main` runs the checks the first already ran. D-09 chose ceremony only
where something automated happens inside it.

**5. The need it serves does not exist here.** Environment branches solve holding
changes back from production while others accumulate — release management for
several contributors on a schedule. One developer, no release train.

## What replaces it

| Want | Mechanism |
|---|---|
| Separate secrets per environment | GitHub Environments: `staging`, `production` |
| A record of what is deployed where | Environment deployment history |
| A human gate before production | A human pushes the `v*` release tag (W4-07). A required reviewer on a `production` environment is the stronger, server-side form — not configured yet. |
| Hold a feature back | Feature flag, or do not merge it yet |
| Know what production is running | The `v*` tag the last Deploy run shipped (its run history) |

**A gate belongs on the environment, not on a branch.** It gives the same control
without letting two lines of history exist.

**Note (W4-07):** `main` is *released by tag*, not deployed on merge (ADR-004 R4).
A `v*` tag on a commit already on `main` is the one release step — still one line
of history, no release branch. Merged-but-unreleased work is simply the commits
after the last tag.

## Consequences

**Good**

- One line of history. What is on `main` is what is released or about to be.
- Build-once-promote stays intact.
- No merge-back, no hotfix exception, no drift.

**Costs accepted**

- Unfinished work cannot sit on a shared branch. It stays local, or merges behind
  a flag. That is a discipline, and it is the intended one.
- Anyone expecting GitFlow will find this surprising. This document is the answer.

## Revisit when

- A second contributor joins and work needs to be held back from production while
  other work ships.
- A release has to be prepared over several days rather than promoted on merge.
