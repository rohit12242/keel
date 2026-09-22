# ADR-004 — Environment topology and deploy triggers

**Decisions:** S1-B, S1-C · **Story:** W3-08 · **Status:** Decided · **Date:** 2026-09-15

> **Revision history.** R1 chose two environments. R2 changed to three after an
> argument for agent-driven QA in a staging environment. **R3 returns to two** —
> the agent work moves to the next release, and one developer operating two
> deployed environments is overhead without a second person to serve.
> The staging design is kept below under *Future scope* rather than deleted.
> Three revisions in one day is worth noticing at the retro: the decision was
> genuinely close, and the deciding factor in the end was operating cost, not
> correctness.

## Context

One developer, one user. The repository is public. D-06 chose AWS for operational
learning and employability. NFR-05 asks for 99% monthly availability on the Today
screen and tolerates up to two unavailable days a year.

## Decision

**One deployed environment: production.**

| Stage | Runs where | Database | Deployed? | Purpose |
|---|---|---|---|---|
| **local** | Your machine | Postgres in Docker | no | Writing code |
| **CI** | Ephemeral, per pipeline run | Service container, discarded | no | Proving the code works |
| **production** | AWS | RDS | **yes** | The real thing. You are the user. |

Local is not an environment anyone else reaches. CI exists for the length of a run
and nobody visits it. **Production is the only thing operated.**

## What this accepts, stated plainly

The strongest argument for a staging environment was not "somewhere to click
around". It was this:

> An ephemeral container proves the **code** works. It does not prove the
> **deploy** works — the infrastructure definition, secrets resolving from
> Parameter Store, the migration running against RDS rather than a local
> container, networking, runtime configuration, the rollback path.

That argument is correct and is not answered by anything below. **With one
deployed environment, the first place a deploy is exercised on real infrastructure
is production.** This ADR accepts that risk rather than solving it, and the
mitigations are partial by design:

- **W3-17 proves the deploy before any real data exists.** The riskiest deploy is
  the first one, and it happens against an empty database this week.
- **A smoke check runs as part of every deploy** — the health endpoint responds
  and one real read returns real data. A deploy that finishes unchecked is a
  deploy you are trusting rather than verifying.
- **Rollback is redeploying the previous artifact**, never a special mechanism,
  and never touches the database.
- **Migrations are expand-migrate-contract** (below), so a rollback of the
  application never requires a rollback of the schema.
- **Migrations are rehearsed locally against a restored production backup.** This
  is the strongest single mitigation, it uses real data rather than staging's
  approximation of it, and it performs NFR-01's restore drill at the same time.

What remains uncovered: an infrastructure or configuration change that is wrong in
a way only real infrastructure reveals. The exposure is one user, a 99% target,
and an automatic rollback path — which is why the risk is acceptable and why it
would stop being acceptable with a second user.

## The migration rule

Not optional, and it carries more weight with one environment than it would with
two.

- **Expand, migrate, contract.** Add the column, backfill, ship code that writes
  both, drop the old column in a *later* release.
- A migration that a rollback of the application would break is not allowed.
- Destructive changes — dropping a column, narrowing a type — ship alone, after
  the code that stopped using the old shape is already live.

With no staging, the first place a migration meets real data is production. The
discipline moves into the migration itself.

## Deploy triggers

**Build once.** One artifact per merge, tagged with the commit. The thing deployed
is the thing the pipeline tested.

| Event | What happens |
|---|---|
| Push to a branch | Pipeline runs (ADR-003). No deploy. |
| Pull request | Full pipeline. No deploy, no secrets — fork safety. |
| **Merge to `main`** | Pipeline → build artifact → migrate → deploy → smoke check |
| Smoke check fails | Automatic rollback to the previous artifact, and a notification |
| Manual | Rollback only |

Merge to `main` deploys. Guardrail 06 says an increment that is not deployed is
not done, and a deploy that needs a human to remember it stops happening in a busy
week.

Migrations run as their own step, before the application deploys, and the deploy
stops if they fail. That ordering is only safe because of the
backward-compatibility rule above.

## Configuration: what differs, and what may not

Differs between local and production: database connection, Cognito pool and
callback URL, application base URL, log level, and a seed-data flag used locally.

**Code never branches on the environment name.** No `if (env === 'production')`.
Behaviour differs on a configuration *value* that says what it needs —
`LOG_LEVEL`, `SEED_DATA` — never on where it happens to be running. An environment
check in code is a bug that appears in only one place, which is the hardest kind
to find.

Secrets live in Parameter Store or Secrets Manager, never in the repository.
`.env.example` is committed with keys and no values; `.env` is ignored. W3-11
implements this.

## Future scope — staging and agent-driven QA

Deferred to the next release, not rejected. The design was worked out and is kept
here so it does not have to be rediscovered.

**The shape:** a staging environment on AWS, deployed from the same pipeline and
the same definition as production. Merge to `main` deploys the artifact to
staging, an agent exercises the journeys, and **the same artifact** is promoted to
production automatically when the agent passes. Build once, deploy twice, promote
what was tested.

**Why an agent changes the argument:** a staging environment normally exists so a
different group can verify without disturbing users. There is no second group —
but an agent is a user of a sort, and one that works while you sleep.

**What an agent catches:** journeys that fail to complete, obvious breakage, error
and empty states that do not render, broken navigation, accessibility violations,
visual regression.

**What it does not catch — the important half:** whether the number is *right*. An
agent sees that a percentage appeared where a percentage was expected. It cannot
know whether 84% is the correct adherence for that week; that requires the rule.
**Keel's entire risk surface is the correctness of computed figures**, and those
are caught by domain unit tests, not by anything driving a browser. An agent is a
complement to that layer and a dangerous substitute for it — dangerous because a
green agent run feels like more coverage than it is.

**Constraint it inherits:** ADR-003 runs pull-request workflows without secrets so
a fork's code never executes with credentials. An agent needs an API key, so it
runs after merge or on pull requests from the repository itself, never on fork
pull requests.

**Cost, when it happens:** a second RDS instance is roughly $14 a month. A cheaper
first step is one instance with two databases, which rehearses the deploy, the
secrets and the migrations but shares an instance — meaning a runaway staging
migration can affect production. Acceptable for one user; not with real users.

**Do not build it inside a spike box.** W3-17 exists to find out whether an AWS
deploy is achievable at all, with a two-hour hard stop. Adding an environment to
that box is how a spike becomes a lost week, which Week 1 already demonstrated.

## Consequences

**Good**

- One database, one Cognito pool, one set of secrets, one thing that can drift.
- The NFR-01 restore drill becomes load-bearing rather than ceremonial — it is how
  migrations get tested.
- Roughly $14 a month not spent, which on a self-funded project belongs in the record as a
  real reason rather than an unstated one.

**Costs accepted**

- The deploy is first rehearsed in production. Named above; mitigated, not solved.
- A bad migration reaches real data first. The expand-migrate-contract rule is a
  discipline, and nothing enforces it automatically.
- No place to show someone a change before it is live.

## Revisit when

- **The next release.** Staging and the agent are already scoped above.
- A second person uses Keel — then "verify before users see it" stops being
  rhetorical and the accepted risk above stops being acceptable.
- A deploy breaks production in a way that local and CI could not have caught.
  That is the evidence that buys staging, and it should be recorded as such rather
  than treated as bad luck.
- A migration causes real data loss despite the rule.
