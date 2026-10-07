# Keel

A logbook that records effort against declared objectives, and the deviations that
pull you off them, so that **the record — not memory — decides what to do next**.

When a mistake is made, add it to **Common mistakes** so it is not made
again.

---

## Architecture

| | |
|---|---|
| Language / framework | TypeScript, Node ≥ 26, Next.js |
| Database | PostgreSQL — `pg` for queries, `node-pg-migrate` for migrations, no ORM |
| Client | Server-rendered by default |
| API | REST behind an OpenAPI 3.1 contract, `docs/keel-api.yaml` |
| Auth | Cognito; the app owns the session |
| Hosting | AWS — ECS Fargate, ALB, RDS, Terraform in `infra/`|
| Shape | Modular monolith with a pure domain |

```
src/
  app/                  Next.js route handlers. HTTP in, JSON out. No rules.
  modules/<feature>/    effort, objectives, today, health
    domain/             pure functions + types
    repo.ts             the only file with SQL in it
    service.ts          one function per use case
  shared/
    db.ts               the one pg Pool
    contract.ts         DTO types matching the contract
    log.ts              structured logs
    result.ts           Ok/Err — rules return a reason rather than throw
    time/               day boundaries — one implementation, nowhere else
  config/env.ts         the only place env vars are read
migrations/             raw SQL in .cjs files
```

**Everything may import `domain/`. `domain/` imports nothing** — no HTTP, no SQL,
no clock, no random source. Enforced by a lint rule. If `domain/` seems to need the
database, the design is wrong, not the rule.

Decisions and their reasons are in `docs/adr/`. The entity model and its invariants
are in `docs/erd.md`; non-functional requirements in `docs/nfrs.md`.

## Commands

```
nvm use                          # Node 26, from .nvmrc
docker compose up -d             # local Postgres (any Docker-compatible runtime)
npm run migrate                  # apply migrations;  migrate:down rolls back one
npm run seed                     # idempotent seed data
npm run dev                      # local server
```

The checks — all must pass locally before work is finished:

```
npm run format:check
npm run lint
npm run typecheck
npm run test:tz                  # unit tests under more than one timezone
npm run contract                 # OpenAPI spec validates
npm run build
npm run commitlint
```

Integration tests (`npm run test:integration:tz`) run in CI only — skip them locally.

## Conventions

- **The contract is the source of truth.** An endpoint is never added or changed
  without changing `docs/keel-api.yaml` in the same commit. Known gaps go in
  `docs/intents/TRIAGE.md`.
- **Failures are Problem Details** (`application/problem+json`). Every endpoint
  declares its failure responses.
- **Aggregates are computed at read time**, never stored — adherence, totals,
  streaks, counts. _(NFR-09)_
- **`local_date` is a `date` sent by the client**, alongside `logged_at` and `tz`.
  _(NFR-12)_
- **Nothing is deleted** except effort entries — rows are ended, completed or
  appended to. _(NFR-01)_
- **Every query filters by user.** No user id in a URL. _(NFR-10)_
- **Logs carry ids and types only**, never user-written text. _(NFR-11)_
- **Colour is never the only signal**; everything is keyboard-operable. _(NFR-13)_
- **Not in v1:** offline logging, timezone/DST behaviour, pagination, repository
  interfaces, event sourcing, DI frameworks, caching or rollups. Also decided and
  deliberate: the sidebar's shared counts have no endpoint — a client derives them
  from what it already fetched; `GET /deviations` requires a date range, so the client
  picks a default; and "the sentence that repeats" has no definition, because sameness
  between two sentences needs its own thinking and is a feature, not plumbing.
- **Ask before adding a runtime dependency.**
- **Git:** branch from `main` as `i-<nn>-<slug>`; `main` changes only through a PR
  with passing checks. Conventional Commits, scope is the module or `ci`, `db`,
  `contract`, `infra`; footer `Intent: I-<nn>`. (`Story: W<week>-<nn>` is the
  historical form and stays valid — see `scripts/check-commits.mjs`.)
- **The repository is public.** Personal tracking material never goes in it.

## How a change is made

Keel is built one **intent** at a time: one user-visible change, statable in a
sentence with no "and" in it. Intent, spec and plan live together in
`docs/intents/I-<nn>-<slug>/` and are committed in the PR that implements it, so the
review running in CI can read them. `docs/intents/README.md` has the full order.

The rules that matter while writing code:

1. **Nothing is implemented without an accepted plan.** `plan.md` carries
   `Status: ACCEPTED <date>` and is committed first and alone. If a step turns out
   to be wrong, stop and say which one — never re-plan silently.
2. **One commit per plan step**, each leaving `main` deployable.
3. **A finding outside this intent goes to `docs/intents/TRIAGE.md`** — never into
   the plan it interrupted.
4. **The PR body stays on one screen.** Fill
   `.github/PULL_REQUEST_TEMPLATE.md` and do not restate the spec or the plan —
   they are in the diff. The section worth writing is *Decided, not specified*:
   the choices the plan did not make. If the body will not fit on one screen, the
   intent was too big; say so rather than writing more.
5. **Never tick the explain-it-unprompted box.** It is Rohit's, and it is the one
   clause the harness must not satisfy on his behalf.

For platform work — CI, hooks, guards — **the ADR is the intent**: no `intent.md`,
and `spec.md` names the ADR instead.

## Pull request review

Before reviewing a pull request, read `REVIEW.md` and follow it.

## Common mistakes

- Storing a derived value (a count, a total, a streak) in a column or accepting it
  in a request body.
- Deriving the day on the server from the request time instead of using the
  client's `local_date`.
- Fetching per objective for Today — it is one query. _(NFR-03)_
- Returning 403 for another user's row — it is 404.
- Importing `@/shared/db`, `@/config` or a repo into `domain/`.
- Reading `process.env` outside `src/config/env.ts`.
- Changing a route without changing the contract.
- Typing the root layout with Next's `LayoutProps` — those types only exist after a
  build, so a cold `npm run typecheck` fails. Keep `children: React.ReactNode`.
- Committing the `nextjs-agent-rules` block that `next dev` appends to this file —
  revert it.
- Creating a branch from `origin/main` leaves it tracking `main`; unset the upstream
  and push with `git push -u origin <branch>`.
