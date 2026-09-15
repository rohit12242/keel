# Local setup

From nothing to a running Keel, in order. Written for someone who has never seen
this repository. No product features exist yet — the goal here is a running app
connected to a running database.

## Prerequisites

Install these first if you do not have them:

- **git**
- **nvm** — https://github.com/nvm-sh/nvm (to get the exact Node version). If you
  manage Node another way, you need **Node 26** (see `.nvmrc`).
- **Docker** with the Compose plugin — Docker Desktop, or `colima` + the `docker`
  CLI on macOS. `docker compose version` must work.

## 1. Clone

```sh
git clone https://github.com/rohit12242/keel.git
cd keel
```

## 2. Node 26

```sh
nvm install   # reads .nvmrc → installs/uses Node 26
nvm use
node -v       # expect v26.x
```

## 3. Install dependencies

```sh
npm ci
```

## 4. Start Postgres

```sh
docker compose up -d
```

Wait until the database reports healthy:

```sh
docker compose ps   # STATUS should show "healthy" for the db service
```

This is an empty database — there is no schema yet (that is a later story). It
just needs to be running and reachable.

## 5. Configure

```sh
cp .env.example .env
```

Open `.env` and set:

| Variable | Value to use locally |
|---|---|
| `DATABASE_URL` | `postgres://keel:keel_local_dev@localhost:5432/keel` |
| `APP_BASE_URL` | `http://localhost:3000` |
| `LOG_LEVEL` | `info` |
| `SEED_DATA` | `false` |
| `SESSION_SECRET` | any long random string — generate one with `openssl rand -hex 32` |
| `COGNITO_POOL_ID` | leave blank |
| `COGNITO_CLIENT_ID` | leave blank |
| `COGNITO_CLIENT_SECRET` | leave blank |

The `DATABASE_URL` above matches the credentials in `docker-compose.yml`. The
`COGNITO_*` variables are unused until auth (E-06) — leaving them blank is
correct. See `docs/configuration.md` for what each variable does.

## 6. Start the app

```sh
npm run dev
```

Then open http://localhost:3000.

## 7. How to tell it worked

- `docker compose ps` shows the `db` service **healthy**.
- `npm run dev` starts without printing a `ConfigError`. If a variable is missing
  or malformed, the app fails immediately at startup and names the exact variable
  — fix that variable in `.env` and start again.
- http://localhost:3000 renders the Keel walking-skeleton page.

To stop: `Ctrl-C` the app, then `docker compose down` (add `-v` to also delete
the database volume).
