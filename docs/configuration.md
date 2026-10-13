# Configuration

Every environment variable Keel reads, what it does, whether it is a secret, and
where its value comes from in each environment.

All of these are read in exactly one place — `src/config/env.ts` — which
validates them at startup and hands the rest of the app typed values. Nothing
else reads `process.env` (a lint rule enforces this). Config *values* differ
between environments; **code never branches on the environment name** — there is
no `if (env === "production")` anywhere, by design (ADR-004).

## The variables

| Variable | What it does | Secret? | Required |
|---|---|---|---|
| `DATABASE_URL` | Postgres connection string the app connects with | **yes** (holds a password) | always |
| `APP_BASE_URL` | The app's own base URL (scheme + host + port), used to build absolute links | no | always |
| `LOG_LEVEL` | Log verbosity: `debug` \| `info` \| `warn` \| `error` | no | always |
| `SEED_DATA` | Whether to load local seed data: `true` \| `false` | no | always |
| `SESSION_SECRET` | Signs the session cookie | **yes** | always |
| `COGNITO_DOMAIN` | The hosted login pages' origin, `https://…amazoncognito.com` | no | always |
| `COGNITO_POOL_ID` | Cognito user pool id; its region prefix names the token issuer | no | always |
| `COGNITO_CLIENT_ID` | Cognito app client id | no | always |
| `COGNITO_CLIENT_SECRET` | Cognito app client secret | **yes** | always |

The four `COGNITO_*` values come from `infra/cognito.tf`. Locally there is no
separate pool: `.env` takes the deployed pool's values, whose app client accepts
a callback on `http://localhost:3000` (I-02).

## Where each value comes from

### local

All values live in `.env` (gitignored, never committed). `.env.example` is the
committed template with keys and no values. `docs/local-setup.md` says what to
put in each one. `DATABASE_URL` points at the Postgres from `docker-compose.yml`;
its password is a local throwaway, not a real secret.

### production (documented here; built in W3-17)

Per ADR-004, **secrets never live in the repository**. Production resolves
configuration from AWS at container start:

| Kind | Where it lives | Examples |
|---|---|---|
| Non-secret config | **SSM Parameter Store** (`String` parameters) | `APP_BASE_URL`, `LOG_LEVEL`, `SEED_DATA`, `COGNITO_DOMAIN`, `COGNITO_POOL_ID`, `COGNITO_CLIENT_ID` |
| Secrets | **AWS Secrets Manager** (or SSM `SecureString`) | `SESSION_SECRET`, `COGNITO_CLIENT_SECRET`, and the credentials inside `DATABASE_URL` |

**How a value gets from there into the running app:** the deploy (W3-17) defines
the container/task with *references* to these Parameter Store and Secrets Manager
entries. The platform resolves them at container start and injects them as
environment variables — the same environment variables `src/config/env.ts` reads
locally. The application code never calls an AWS API to fetch config: resolution
happens at the deployment boundary, so the code path is identical in every
environment. That is the point of ADR-004's rule against branching on the
environment name.

`DATABASE_URL` in production points at RDS, assembled from the RDS endpoint plus
credentials held in Secrets Manager. It is never the local `docker-compose`
database.

> This document describes the production mechanism. It does not create any AWS
> resource — that is W3-17.
