# Keel

A logbook that records effort against declared objectives, and the deviations that
pull you off them, so that **the record — not memory — decides what to do next**.
Single user for v1. Built to learn end-to-end product development, so *why* a
thing is done is part of the deliverable, not overhead.

## Stack — decided, do not relitigate

| | | ADR |
|---|---|---|
| Language / framework | TypeScript on Node, Next.js (Node ≥ 26) | D-02 |
| Database | PostgreSQL, relational | D-03 |
| Client | Server-rendered by default | D-04 |
| API | REST behind a written OpenAPI contract | D-05 |
| Hosting | AWS | D-06 |
| Auth | Managed provider (Cognito, conditional on D-06) — app owns the session | ADR-002 |
| Architecture | Modular monolith, pure domain | ADR-001 |

If a task seems to need a different choice, **say so and stop** — do not quietly
work around a decision. Changing one means writing an ADR.

## The one architectural rule

```
src/
  app/                  Next.js route handlers. HTTP in, JSON out. No rules.
  modules/<feature>/
    domain/             pure functions + types
    repo.ts             the only file with SQL in it
    service.ts          one function per use case
  shared/time/          day boundaries — one implementation, nowhere else
  shared/result.ts      Ok/Err, so rules return a reason rather than throw
```

**Everything may import `domain/`. `domain/` may import nothing** — not route
handlers, not the repository, not any library that speaks HTTP or SQL, not the
clock, not a random source. A domain function takes values and returns values.

This exists because `adherence` is needed on six screens. Six implementations
would disagree, and Keel's only claim is that the record decides.

Enforced by an import-boundary lint rule in CI. If you find yourself wanting to
import the database client into `domain/`, the design is wrong, not the rule.

## Rules that constrain everyday code

- **No aggregate is ever stored.** Adherence, totals, streaks, extension counts,
  sequence numbers, "3 before" counts — all computed at read time. No migration
  adds a rollup column; no request body accepts one. *(NFR-09)*
- **`local_date` is stored as a `date`**, alongside `logged_at` (timestamptz) and
  `tz`. The client sends the day it means; the server never derives it from the
  request time. *(NFR-12, kept half)*
- **Today is one query.** Objectives joined to slots and entries for a single
  date, filtered by user. No fan-out, no query-per-objective. *(NFR-03)*
- **Every endpoint has a defined failure response.** No operation ships with only
  a happy path. Problem Details (RFC 9457), `application/problem+json`. *(NFR-07)*
- **Nothing is deleted.** Objectives are completed or ended; reviews are discarded
  only while drafts; verdicts and status changes append. Effort entries are the
  one exception. *(NFR-01)*
- **Entry text never leaves the system in readable form.** No deviation reason,
  review answer or objective note in logs, analytics or error reports. Error
  reports carry ids and types only. *(NFR-11)*
- **Every query filters by user.** No user id appears in any URL path. A row that
  belongs to someone else returns 404, not 403. *(NFR-10)*
- **Keyboard-operable, and colour is never the only signal.** Status that uses
  colour also carries a word or a shape. *(NFR-13)*

## The contract is the source of truth

`docs/keel-api.yaml` — OpenAPI 3.1. It was written before the code.

- Do not add, rename or change an endpoint without changing the contract in the
  same commit.
- The spec must validate, and every operation must declare its failure responses.
- Known gaps are tracked in `docs/api-gaps.md`. If you hit one, add to that file
  rather than inventing a fix.

## Deliberately out of scope for v1

Do not add these helpfully. Each was decided, not forgotten.

- **Offline logging** (NFR-06) — no sync queue, no client-generated ids, no
  conflict resolution.
- **Timezone and DST correctness** (NFR-12 behaviour) — deferred to v2. The
  *column* stays; the test matrix does not.
- **Pagination** — 1,680 rows per user per year. If a list needs paging, the data
  model changed.
- **Repository interfaces / ports and adapters** — add when a second storage
  implementation exists, not before.
- **Event sourcing** — the append-only tables already carry the useful half.
- **A dependency-injection framework** — pass arguments.
- **Caching, denormalised rollups, archive tables, a second datastore** — there is
  no scale problem to solve.

Ask before adding any runtime dependency. "It is only a small package" is how a
solo project acquires a supply chain.

## Branching and commits

- `main` is always deployable. Work on short-lived branches.
- Merge through a pull request. Checks must pass before merge.
- Never push directly to `main`.

Commit format — Conventional Commits, with the story id in the footer:

```
feat(effort): log an entry against a plan slot

Entries carry local_date and tz from the client. `extra` is derived,
not stored — see ADR-001.

Story: W3-14
```

Types: `feat` `fix` `docs` `refactor` `test` `chore`.
Scope: the module (`effort`, `objectives`, `reviews`, `parking`, `time`) or
`ci`, `db`, `contract`.

The story id matters more than it looks — it is how the sprint sheet and the
repository stay connected at retrospective.

## Definition of Done

Every story:

1. The named output exists and can be pointed at.
2. It can be explained unprompted, including one thing worth changing.
3. Actual hours are in the sprint sheet, including the embarrassing ones.
4. Anything changed or revealed is written where it would be looked for — ADR,
   gap list, ERD or contract.

If it touched code, additionally:

5. The pipeline is green — on the pipeline, not on a laptop.
6. It reached `main` through a PR with blocking checks.
7. No NFR was quietly broken (usually: did this store an aggregate, or a date that
   could move?).
8. The failure path exists, not just the happy one.

## Where things live

| | |
|---|---|
| `docs/adr/` | Decision records. ADR-001 architecture, ADR-002 auth. |
| `docs/keel-api.yaml` | The API contract. |
| `docs/api-gaps.md` | Known contract gaps, open and closed. |
| `docs/erd.md` | Entity model — 11 entities, 16 invariants. |
| `docs/design/` | Screen designs — 15 artboards. |
| `docs/spikes/` | Spike write-ups. |
| `docs/nfrs.md` | 13 non-functional requirements, with scope changes noted. |
| `docs/flows.md` | Mermaid flow diagrams. Orientation only; the flow map spreadsheet is the spec. |
| `docs/build-log/` | Daily notes, written by hand. Not generated. |

## Working style

- **Read the ADR before proposing an alternative.** Most "obvious improvements"
  here were considered and rejected for a reason that is written down.
- **Prefer the boring option.** This codebase has one user and one developer.
- **When a decision is needed, stop and name it** rather than picking silently.
  Unmade decisions belong in the register, not in a commit.
- The build log is written by a human. Do not generate it.

## Open — needs settling

- ~~Branch protection on a private free repo~~ — settled: the repository is
  **public**, so branch protection and required status checks are available.
- D-08 (test strategy) currently names a coverage target. Under review — the four
  NFR checks are the ones that discriminate.

## This repository is public

The sprint sheets, daily log, parking lot and retrospectives live outside it, in a
private folder. They contain personal notes.

**Never copy tracking material into this repository**, and keep `docs/build-log/`
technical — it is public too. `.gitignore` blocks `*.xlsx` and `*.numbers` as a
backstop, but the real guard is knowing which folder a file belongs in.

## Delegating a story

One story, one command: `/story W4-07`. It reads the brief in
`../Keel_doc/stories/`, runs the **spec-checker** before any code, implements,
runs the checks, runs the **reviewer**, and opens the PR with the handover in
its body. The hooks in `.claude/hooks/` refuse the things this file says not to
do; `.claude/README.md` explains each piece and why. When a PR needs rework, the
fix goes into the harness before the next story is delegated.
