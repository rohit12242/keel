# Keel

A logbook that records effort against declared objectives, and the deviations
that pull you off them — so that the record, not memory, decides what to do next.

Built in public as an end-to-end product-development exercise: every decision has
a written record, every requirement has a number, and the contract was written
before the code.

## Status

Sprint 01 — walking skeleton. No product features yet.

## What is here

| Path | |
|---|---|
| `CLAUDE.md` | Project conventions and constraints, loaded by Claude Code |
| `docs/product-brief.md` | What Keel is and who it is for |
| `docs/spec.md` | v1 feature list |
| `docs/nfrs.md` | 13 non-functional requirements, each with a number and a check |
| `docs/erd.md` | Entity model — 11 entities, 16 invariants |
| `docs/keel-api.yaml` | OpenAPI 3.1 contract, written before the code |
| `docs/api-gaps.md` | Known gaps between contract and screens |
| `docs/adr/` | Architecture decision records |
| `docs/contributing.md` | Branching, commit convention and the review gate |
| `docs/spikes/` | Spike write-ups |
| `docs/flows.md` | Screen flow diagrams |
| `docs/design/` | Screen designs |
| `docs/definition-of-done.md` | Definition of Ready and Definition of Done |
| `docs/build-log/` | Daily notes, written by hand |

## Reading order

If you have ten minutes and want to see how it was built rather than what it does:
`docs/product-brief.md` → `docs/nfrs.md` → `docs/adr/ADR-001-architecture-style.md`
→ `docs/api-gaps.md`. The last one is the most honest.

## Stack

TypeScript on Node (≥ 26), Next.js, PostgreSQL, deployed on AWS.
Each of those is an ADR, not a default.
