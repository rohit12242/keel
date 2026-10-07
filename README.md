# Keel

A logbook that records effort against declared objectives, and the deviations
that pull you off them — so that the record, not memory, decides what to do next.

Built in public as an end-to-end product-development exercise: every decision has
a written record, every requirement has a number, and the contract was written
before the code.

## What is here

| Path | |
|---|---|
| `CLAUDE.md` | Project conventions and constraints, loaded by Claude Code |
| `REVIEW.md` | What the reviewer running in CI checks, and what counts as Important |
| `docs/product-brief.md` | What Keel is and who it is for |
| `docs/nfrs.md` | 13 non-functional requirements, each with a number and a check |
| `docs/erd.md` | Entity model — 10 entities, 17 invariants, 0 stored aggregates |
| `docs/keel-api.yaml` | OpenAPI 3.1 contract, written before the code |
| `docs/adr/` | Architecture decision records |
| `docs/intents/` | One folder per intent, and the triage queue |
| `docs/design/` | Fifteen screen designs, and the same screens on one canvas |
| `docs/flows.md` | Screen flow diagrams |
| `docs/domain/` | Rules too long for the ERD — review windows |
| `docs/contributing.md` | Branching, commit convention and the review gate |
| `docs/local-setup.md` | Getting it running |
| `docs/configuration.md` | Every environment variable, and the rule against branching on environment |
| `docs/runbook.md` | Deploy and roll back |
| `docs/spikes/` | Spike write-ups |
| `docs/build-log/` | Daily notes, written by hand |

## Reading order

If you have ten minutes and want to see how it was built rather than what it does:
`docs/product-brief.md` → `docs/nfrs.md` → `docs/adr/ADR-008-scheduling-logic.md`
→ `docs/intents/README.md`. ADR-008 is the one that deleted a table and a column
for being derivations in disguise.

## Stack

TypeScript on Node (≥ 26), Next.js, PostgreSQL, deployed on AWS.
Each of those is an ADR, not a default.
