# Plan — I-02 · Building the remaining backend of Keel

**Intent:** `intent.md` · **Spec:** `spec.md` (Accepted 2026-10-12) · **Status:** ACCEPTED 2026-10-13 · **Written:** 2026-10-13

## What is already built, and what is not

Read from the code:

- **Operations:** 7 of 29 exist. `getHealth`, `getDay`, `createEffortEntry`,
  `listObjectives`, `createObjective`, `getObjective`, `getObjectiveSchedule`.
  None is under `/v1`. Every service takes its user from
  `getConfig().seedUserId` (`today`, `effort`, `objectives` services).
- **Schema:** `user` (with an unused `password_hash`, no `idp_subject`),
  `objective`, `plan_segment`, `effort_entry`, `status_event`. **Missing:**
  `review`, `deviation`, `deviation_objective`, `deviation_pattern`,
  `parked_idea`, `parked_idea_verdict`, and the FKs that were left as plain uuids
  (`objective.from_parked_idea_id`, `plan_segment.created_by_review_id`).
- **Reusable as it is:** `withTransaction` (`shared/db.ts`); `problem`,
  `isUuid`, `notFound`, `unavailable` (`shared/http.ts`); `withRequestLog`;
  `Result` (`shared/result.ts`); `localDayOf` (`shared/time/localDay.ts`);
  `planSlots`, `coveringSlot`, `isDateInPlan`, `statusOn`, `currentStatus`,
  `figures` (`effort/domain/adherence.ts`), `datesBetween`, `scheduleLabel`;
  the one-query read in `objectives/repo.ts` `getObjectiveRows`.
- **Gaps I-01 left, by design:** `next_review_on`, `reviews_due`,
  `committed_minutes_per_week`, `criteria_verdict` are omitted
  (`assembleObjective.ts:25`). `Day.last_deviation` is hard-coded `null`.
  `from_parked_idea_id` is refused with 400.
- **The Today scaffold page** (`app/page.tsx`) fetches `/day` with no cookie. It
  breaks the moment routes need a session, so it is in step 6.
- **Infra:** no Cognito, no domain, no ACM; ALB is HTTP :80 only. The deploy role
  has no `cognito-idp`, `acm` or `route53` permissions. `SESSION_SECRET` exists in
  SSM. Applying Terraform is a human action (the guard hook).
- **The integration tests share the seed.** Five suites read the seeded user and
  objective at fixed ids (`computed-slot`, `create-effort`, `date-storage`,
  `create-objective`, `schema-constraints`), and two of them reset it between
  cases by deleting effort entries and status events. CI runs `npm run seed`
  before them. `SEED_DATA` is required by `env.ts` and read by nothing.
- **Deployed record:** the seed user, `founder@keel.local` (commit 81635c5).
  `SEED_DATA=false` on ECS. A first sign-in creates a new user; that row stays,
  unreachable, because nothing is deleted (NFR-01).

## Files that change

| Step | File | Change |
|---|---|---|
| **PR 1** | | |
| 1 | `infra/cognito.tf` *(new)*, `infra/ssm.tf`, `infra/ecs.tf`, `infra/variables.tf`, `infra/outputs.tf` | User pool (email sign-in, email verified, self sign-up on), hosted domain, app client (code + PKCE, client secret, callback `http://localhost:3000/v1/session/callback`, logout `http://localhost:3000/`). `COGNITO_*` into SSM (secret as SecureString) and into the task definition |
| 1 | `infra/bootstrap/iam.tf` | Deploy role gains `cognito-idp:*` |
| 2 | `migrations/<ts>_user-idp-subject.cjs` *(new)* | `user.idp_subject text UNIQUE NULL`; drop `password_hash` (no reader, never set) |
| 3 | `src/config/env.ts` (+ `env.test.ts`) | `COGNITO_DOMAIN`, `_POOL_ID`, `_CLIENT_ID`, `_CLIENT_SECRET` become required |
| 3 | `src/modules/session/domain/session.ts` *(new, + test)* | Pure: encode/decode the session payload `{ uid, exp }`, expiry check against a passed-in `now`; `signInDecision(claims, rowBySubject)` → use / create (ERD, *User*: no matching by email); claim checks (`iss`, `aud`, `exp`, `email_verified`, `token_use`) |
| 3 | `src/shared/session.ts` *(new, + test)* | HMAC-SHA256 sign/verify with `node:crypto` and `SESSION_SECRET`; cookie read/write (`keel_session`, HttpOnly, Secure, SameSite=Lax, 30 days); the short-lived sign-in cookie (`state`, PKCE verifier, 10 min) |
| 3 | `src/modules/session/idp.ts` *(new)* | The only file that talks to Cognito: authorize URL, token exchange (5 s timeout) |
| 3 | `src/modules/session/repo.ts`, `service.ts` *(new)* | `findUserBySubject`, `createUser`; `startSignIn`, `completeSignIn`, `signOut`. `createUser` returns a refusal, not a throw, when the insert hits the unique email — the constraint decides, so two sign-ins racing cannot both pass a check |
| 4 | `src/app/v1/session/sign-in/route.ts`, `…/callback/route.ts`, `src/app/v1/session/route.ts` *(new)* | `GET`, `GET`, `DELETE`, as the contract declares |
| 4 | `docs/keel-api.yaml`, `docs/erd.md` | `completeSignIn` gains a `409`: the email already belongs to a Keel user under another subject — a provider account deleted and recreated. Nothing is written and no session is issued. The ERD's *User* section says so |
| 4 | `docs/runbook.md` | Recovering a recreated provider account: after confirming it is the same person, point the existing row's `idp_subject` at the new subject. One production write, made by hand, never by the app |
| 5 | `src/app/day/**`, `src/app/objectives/**` → `src/app/v1/**` | The six routes move unchanged: paths and imports only, no behaviour |
| 5 | `src/app/page.tsx` | Fetches `/v1/day/…` |
| 5 | every existing `*.itest.ts` | Import paths and request URLs only; assertions untouched, so a passing suite proves the move changed nothing |
| 6 | `src/shared/http.ts` | `withSession(handler)`: reads the cookie, 401 `Unauthenticated` without a valid one, passes `userId` |
| 6 | `src/app/v1/day/**`, `src/app/v1/objectives/**` | Each handler wraps in `withSession` |
| 6 | `src/modules/{today,effort,objectives}/service.ts` | Take `userId` as an argument; `getConfig()` no longer read for a user |
| 6 | `src/config/env.ts`, `.env.example`, `docs/configuration.md` | `SEED_USER_ID` / `seedUserId` removed |
| 6 | `src/app/page.tsx` | Forwards the request cookie; signed out, links to sign in |
| 6 | `src/test/session.ts` *(new)* | Mints a signed cookie for a user id, for itests |
| 6 | `src/test/fixtures.ts` *(new)* | `testUser()`: a fresh user per call — random id, `itest-<id>@keel.test`, its own `idp_subject` — returned with a minted cookie. `testObjective(user, body)`: written through `createObjective`, so a fixture obeys the same rules and gets its `created` event like any objective. Nothing at a fixed id |
| 6 | every existing `*.itest.ts` | Each suite creates the users and objectives it needs in `beforeAll` and owns them. The fixed seed ids, `getConfig().seedUserId`, and the between-case `DELETE`s of effort entries and status events go: a case that needs a clean objective makes a new one |
| 6 | `src/authorization.itest.ts` *(new)* | Table-driven: every operation without a cookie → 401; another user's id → 404 (NFR-10, NFR-11's authorisation suite). Grows a row per operation in every later step |
| 6 | `src/contract-coverage.itest.ts` *(new)* | Reads `docs/keel-api.yaml`. Every handler under `src/app/v1/` (and `/health`) is a contract operation; every operation not marked `security: []` that has a handler has a row in the authorisation table. Operations not built yet are listed by name in the test; each later step removes its own, and step 28, which builds the last one, deletes the list |
| 6 | `docs/local-setup.md` | Signing in locally |
| 7 | `scripts/seed.mjs`, `package.json` | Deleted, with the `seed` script. Nothing reads its rows any more: tests make their own, and a local sign-in creates its own user |
| 7 | `.github/workflows/ci.yml` | The `Seed` step and `SEED_DATA` go; the integration job runs against a freshly migrated, empty database |
| 7 | `src/config/env.ts` (+ `env.test.ts`), `.env.example`, `docs/configuration.md`, `docs/local-setup.md` | `SEED_DATA` / `seedData` removed (required, never read). Local setup is migrate, then sign in |
| 7 | `docs/erd.md` | `idp_subject`: "Null only on a row written before sign-in existed" — no longer the seed script's |
| 7 | `docs/intents/TRIAGE.md` | ADR-004 names `SEED_DATA` as an example of per-environment config; the variable no longer exists. Not edited here |
| **PR 2** | | |
| 8 | `package.json` | `swagger-ui-dist`, exact version (approved in the spec) |
| 8 | `src/app/docs/route.ts`, `src/app/docs/[file]/route.ts` *(new)* | The page (HTML + its own init script), an allowlist of `swagger-ui-dist` assets, and `keel-api.yaml` read from `docs/` — never a copy. CSP `default-src 'self'`. A banner: on the deployed service a request is a real write and nothing is deleted |
| 8 | `next.config.ts` | `outputFileTracingIncludes` so the standalone image carries `docs/keel-api.yaml` and the assets |
| 8 | `src/app/docs/docs.itest.ts` *(new)* | The served contract is byte-identical to the file; assets 200; an unknown file 404 |
| **PR 3** | | |
| 9 | `src/modules/effort/domain/validateEffortEdit.ts` *(new, + test)*, `effort/repo.ts`, `effort/service.ts`, `src/app/v1/effort-entries/[entryId]/route.ts` *(new)* | `PATCH`, `DELETE`. `local_date` in a body is a 400. 422 unless the objective is active. Repo joins `objective` on `user_id` |
| 10 | `src/modules/effort/domain/effortMonth.ts` *(new, + test)*, `effort/repo.ts`, `src/app/v1/objectives/[objectiveId]/effort/route.ts` *(new)* | `listObjectiveEffort`: weeks start Monday (weekday 1, as the contract numbers them), planned days with no entry, `vs_target`, sessions, longest streak, extra off-day minutes. One query |
| 11 | `src/modules/objectives/domain/statusChange.ts` *(new, + test)*, `objectives/repo.ts`, `service.ts`, `src/app/v1/objectives/[objectiveId]/status-changes/route.ts` *(new)* | The transition table; 409 for a change that does not follow, or a date before the latest event; append in one insert |
| 12 | `src/modules/objectives/domain/assembleObjective.ts` (+ test), `src/app/v1/objectives/route.ts` | `committed_minutes_per_week` from the segment in force today, active only |
| **PR 4** | | |
| 13 | `migrations/<ts>_deviations.cjs` *(new)* | `deviation_pattern` (unique per user, case-insensitive name), `deviation`, `deviation_objective` with both composite FKs; `objective UNIQUE (id, user_id)` for them; verdict and `verdict_review_id` null together (CHECK), and verdict only on `chosen` |
| 14 | `src/modules/deviations/{domain,repo.ts,service.ts}` *(new)*, `src/app/v1/deviation-patterns/route.ts` *(new)* | `GET` with computed `occurrences`, `POST` (409 on duplicate name) |
| 15 | `src/modules/deviations/domain/validateDeviationWrite.ts` *(new, + test)*, `repo.ts`, `service.ts`, `src/app/v1/deviations/route.ts` *(new)* | `POST`: deviation and its objective rows in one transaction; 422 when an objective is not the caller's, not active or not planned that day, the date is after today in the user's `tz`, or the pattern is not theirs. `GET`: range required, `objective_id` filter, cost tallies, one query |
| 16 | `src/modules/today/{repo.ts,domain/assembleDay.ts}` (+ test), `src/shared/contract.ts` | `last_deviation`, inside the same single Today query |
| **PR 5** | | |
| 17 | `migrations/<ts>_parking-lot.cjs` *(new)* | `parked_idea`, `parked_idea_verdict`; FK `objective.from_parked_idea_id` |
| 18 | `src/modules/parking/domain/{lockedUntil,assembleIdea}.ts` *(new, + tests)*, `repo.ts`, `service.ts`, `src/app/v1/parked-ideas/route.ts` *(new)* | `lockedUntil` per `docs/domain/parking-lock.md`. `POST` writes the idea and its first `parked` verdict in one transaction. `GET`: current verdict, `locked` against today in the user's `tz`, `became_objective_id`, `taken_early` — one query |
| 19 | `src/app/v1/parked-ideas/[ideaId]/verdicts/route.ts` *(new)*, parking service | Append; 409 once taken; 422 while locked |
| 20 | `objectives/domain/validateObjectiveWrite.ts`, `objectives/repo.ts`, `service.ts`, `docs/keel-api.yaml` | `from_parked_idea_id` accepted: 422 unless the caller's and currently parked; the `taken` verdict written in the same transaction, dated `starts_on`. The contract's interim "refused with 400" text is removed in this commit |
| **PR 6** | | |
| 21 | `migrations/<ts>_reviews.cjs` *(new)* | `review` and its enums; `UNIQUE (objective_id, period_start, period_end)`; plan-end-only fields null on other kinds (CHECK, invariant 8); FKs `plan_segment.created_by_review_id`, `deviation.verdict_review_id` |
| 22 | `src/modules/reviews/domain/{reviewWindows,reviewSchedule,dueWindows}.ts` *(new, + tests)*, `objectives/domain/assembleObjective.ts`, `objectives/repo.ts` | `docs/domain/review-windows.md` as written; `next_review_on` and `reviews_due` on every objective read, from saved reviews joined into the same query |
| 23 | `src/modules/reviews/domain/assembleReview.ts` *(new, + test)*, `reviews/repo.ts`, `service.ts`, `src/app/v1/objectives/[objectiveId]/reviews/route.ts`, `src/app/v1/reviews/[reviewId]/route.ts` *(new)* | `listReviews`, `startReview` (no body → the due window, 422 if none; a body → must be a real window, 409 if saved), `getReview`: figures over the window, `minutes_per_day`, deviations naming the objective in the period, ideas caught in the period with the verdict as it stood at period end, previous review and its note. One query per read |
| 24 | `reviews/domain/validateReviewWrite.ts` *(new, + test)*, route | `PATCH` (draft only, 409 once saved; 422 for plan-end fields on a periodic review), `DELETE` (draft only) |
| 25 | `src/app/v1/reviews/[reviewId]/deviation-verdicts/[deviationId]/route.ts` *(new)*, reviews service | `PUT`; 409 if another review judged it; 422 drifted, outside the period, or not naming this objective |
| 26 | `src/app/v1/reviews/[reviewId]/save/route.ts` *(new)*, reviews service | Save a weekly/monthly review: 422 while a chosen deviation in the period is unjudged; `previous_review_id` set at save |
| **PR 7** | | |
| 27 | `reviews/domain/planEnd.ts` *(new, + test)*, reviews service/repo, `assembleObjective.ts` | Saving a plan-end review: outcome and criteria verdict required; `completed`/`paused`/`ended` writes the status event dated `period_end` in the same transaction (invariant 7); `criteria_verdict` on the objective |
| 28 | `objectives/domain/validateExtension.ts` *(new, + test)*, objectives repo/service, `src/app/v1/objectives/[objectiveId]/extensions/route.ts` *(new)* | 409 for no/used/non-`continued` review or a plan not yet ended; 422 unless the new end is after today in the user's `tz`; the segment inserted with `created_by_review_id` |
| 29 | `src/story.itest.ts` *(new)*, `scripts/story-check.mjs` *(new)* | The intent's check: created → effort → a chosen deviation → a parked idea → a weekly review → the plan-end review completes it → read back. Back-dated, so every window has already closed. The script runs the same story over HTTP, given a base URL and a session cookie |
| **PR 8** | | |
| 30 | `infra/https.tf` *(new)*, `infra/alb.tf`, `infra/network.tf`, `infra/cognito.tf`, `infra/ecs.tf`, `infra/outputs.tf`, `infra/bootstrap/iam.tf` | The hosted zone, an ACM certificate validated by DNS, an HTTPS listener (`ELBSecurityPolicy-TLS13-1-2-2021-06`), and :80 redirecting to it. Cognito callback/logout on the domain; `APP_BASE_URL` on the domain; `SEED_DATA` leaves the task definition (only now: until step 7 deploys, the image requires it); the deploy role gains `acm`/`route53` |
| 30 | `.github/workflows/deploy.yml`, `docs/runbook.md` | Smoke check and runbook on `https://<domain>/health` |
| 31 | none | Release tag; the first deployed sign-in creates Rohit's user |
| 32 | none | `scripts/story-check.mjs` against the deployed service |

## Order of work

Each step is one commit and leaves `main` deployable. Steps 1–29 are built and
tested locally and in CI; nothing needs the deployed service until step 30.

**PR 1 — Sign in, and every request is the caller's**

1. **Cognito in Terraform.** `terraform plan` shown; Rohit applies bootstrap (root
   profile) then app. If AWS refuses Cognito on this account, stop and report.
   Applied before PR 1 merges, so the task definition already carries `COGNITO_*`
   when step 3 makes them required.
2. **`idp_subject`, and no password column.**
3. **The session and the sign-in decision, unrouted.** Pure rules and the cookie
   signer, with nothing calling them yet.
4. **The three session routes.** Rohit signs in on localhost against the real pool
   and a new, empty user is created.
5. **The move to `/v1`.** Paths only. The tests change their URLs and nothing
   else, so a green run says the move broke nothing.
6. **Every request is the caller's.** `withSession` on every route, `seedUserId`
   deleted, the authorisation suite, and the contract-coverage test — from here
   on, a route without a session check or an authorisation row fails CI. The
   itests are rewritten here anyway, so this is where each suite starts making its
   own users: a cookie has to belong to someone, and it is never the seed.
7. **The seed goes.** Once no test reads it, `scripts/seed.mjs`, the CI step and
   `SEED_DATA` are removed. Local data comes from signing in and using the API
   (the contract page, from step 8).

**PR 2 — The contract page**

8. **`/docs`.**

**PR 3 — Correcting effort and changing status**

9. Effort edit and delete. 10. The effort month. 11. Status changes. 12. Committed minutes per week.

**PR 4 — Deviations**

13. The schema. 14. Patterns. 15. Deviations. 16. Today's `last_deviation`.

**PR 5 — The parking lot**

17. The schema. 18. Park and list. 19. Verdicts. 20. Taking an idea.

**PR 6 — Reviews**

21. The schema. 22. Windows and what is due. 23. Starting and reading a review.
24. Autosave and discard. 25. Deviation verdicts. 26. Saving a periodic review.

**PR 7 — The plan end, and the whole story locally**

27. Saving a plan-end review applies its outcome. 28. Extensions; the
not-yet-built list in the coverage test is now empty and goes. 29. The story, in
CI and against `npm run dev`.

**PR 8 — HTTPS, and the deployed run**

30. **HTTPS.** Blocked on outside events, and nothing in steps 1–29 waits for
    it. Rohit has an AWS Support case open for CloudFront and is not buying a
    domain until it is answered. Two paths, and **which one is Rohit's call**:
    - **A registered domain + ACM on the ALB** — what the spec and ADR-006 say
      today, and the only path where nothing crosses the wire in clear. The files
      in the table above are this path.
    - **CloudFront on its default certificate** — ready on the unpushed branch
      `cloudfront-https-staged` (`aad7cdc`). Its CloudFront → ALB leg is plain
      HTTP and its viewer TLS floor is 1.0, so it does **not** meet the spec's
      "no credential and no entry crosses the wire in clear" (NFR-11). Choosing it
      means amending the spec and ADR-006 first (the R4 draft is `0c1462e` on
      `cloudfront-https`) — a stop-and-ask, not a plan step.

    Either way: `terraform plan` shown; Rohit applies. The Cognito callback and
    `APP_BASE_URL` move to whichever HTTPS host exists.
31. **Release, and the first deployed sign-in.** A release tag, and Rohit signs
    in. The sign-in creates a new user; the seed row already there is left as it
    is, since nothing is deleted.
32. **The deployed story.** Stop and ask before running it: it writes a permanent
    objective into the real record, and nothing deletes it. Then run
    `scripts/story-check.mjs` against the domain with Rohit's session cookie.

## Risks

- **Step 6 is the riskiest step: every existing route gets its session check at
  once.** A route missed or wrapped wrongly lets a request through without a
  session or shows one user another's rows (NFR-10), and nothing obvious breaks —
  it builds, and the happy paths pass. The tests that would catch it are
  rewritten in the same commit, so a wrong test can pass wrong code; and once it
  merges, the deployed API answers 401 to everything but `/health` until PR 8,
  which waits on AWS Support.
  *Mitigation:* the move to `/v1` is its own step (5), proven by the old
  assertions passing unchanged, so step 6 changes behaviour only. The
  contract-coverage test lands in step 6, not at the end, so every later route
  that lacks an authorisation row fails CI instead of relying on memory.

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | `terraform plan` reviewed; the pool, client and parameters exist after apply | Infra only; the running image ignores new env vars |
| 2 | Migration up/down locally; the schema itest asserts `idp_subject` unique and no `password_hash` | Expand plus dropping a column nothing reads |
| 3 | Unit: tampered, expired and wrong-secret cookies refused; use/create/unverified-email decisions; claim checks. `env.test.ts` for the new required vars | Nothing calls it |
| 4 | Itest with an injected token exchange: bad `state` 400, refused code 401, provider down 503 within 5 s, create then reuse on a second sign-in with the same subject, an email held by another subject 409 with no row written and no cookie set. Manual: real sign-in on localhost | New routes only |
| 5 | The existing itests pass with only their URLs changed | Deploys and passes `/health` (unchanged); nothing outside the app calls the old paths |
| 6 | Authorisation suite: 401 without a cookie, 404 across users, for all six operations. The coverage test passes, and fails when a handler is added without an authorisation row (checked once by hand). Existing itests pass with a minted cookie, each on users it made itself; the four per-timezone runs share one database without colliding, because every run makes new users. A session stays valid with the provider unreachable (no network call in `withSession`) | Deploys and passes `/health` (unchanged). The deployed API answers 401 until PR 8; nothing there depends on it |
| 7 | CI's integration job passes with no `Seed` step, on an empty database; nothing under `src/`, `scripts/` or `.github/` names the seed | The image stops requiring `SEED_DATA`; the task definition still sets it, which is harmless |
| 8 | `docs.itest.ts`; manual: send a request from the page signed in (200) and signed out (401) | New routes; one approved dependency |
| 9–12 | Unit per domain function; itests per declared response; authorisation rows | Additive routes |
| 13, 17, 21 | Migration up/down; schema itests for each CHECK and composite FK (another user's objective cannot be named) | Expand-only |
| 14–16 | Unit; itests incl. the all-or-nothing deviation write; one-query test for the list and for Today | Additive |
| 18–20 | Unit for `lockedUntil` (the design's three dates), `taken_early`; itests incl. the all-or-nothing park and take | Additive; step 20 widens an accepted input |
| 22 | Every edge case `review-windows.md` names, under four TZs | Read-only fields added |
| 23–26 | Unit; itests per declared response; one-query tests for the list and the review read | Additive |
| 27–28 | Unit; itest: a saved plan-end outcome and the status history agree; an extension ending today is a 422. After 28 the coverage test holds every operation, with nothing excused | Additive |
| 29 | `story.itest.ts` in CI; `story-check.mjs` against `npm run dev` | Test and script only |
| 30 | `terraform plan` reviewed; `http://<domain>` redirects; `/health` on HTTPS; TLS 1.0/1.1 refused (`openssl s_client`) | The smoke check moves with it |
| 31 | Sign-in on the domain creates a user; `GET /v1/objectives` returns an empty list | A release of what CI already proved |
| 32 | The script reads the whole story back from the deployed service | Read and write through the contract only |

