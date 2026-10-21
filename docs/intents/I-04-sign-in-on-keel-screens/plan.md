# Plan — I-04 · Sign in on Keel's own screens

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-10-21 · **Written:** 2026-10-21

**The spec was revised first** (7743f05): the five auth screens are in scope,
onboarding stays out so a confirmed account lands on Today, and confirmation and reset
share one Keel-worded email because Cognito has a single code template (a
CustomMessage Lambda was considered and not chosen).

---

## What the code has today, and what replaces each part

| Today (redirect flow) | Where | Replaced by |
|---|---|---|
| `GET /v1/session/sign-in` | `src/app/v1/session/sign-in/route.ts` | Nothing on the server. The browser signs in to Cognito with SRP on `/sign-in` |
| `GET /v1/session/callback` | `src/app/v1/session/callback/route.ts` | `POST /v1/session` (the ID-token exchange) |
| `idp.ts`: `authorizeUrl`, `exchangeCode`, `jwtPayload`, `EXCHANGE_TIMEOUT_MS` | `src/modules/session/idp.ts` | `cognito.ts`: fetch the pool's JWKS (5 s timeout) and verify the ID token's RS256 signature with `node:crypto`. No new dependency |
| `startSignIn`, `completeSignIn` | `src/modules/session/service.ts` | `createSession(idToken, origin, now)` and `sessionOf(cookie, now)` |
| Sign-in cookie `keel_sign_in` (`state` + PKCE verifier): `signInCookie`, `readSignIn`, `clearSignInCookie`, `SIGN_IN_COOKIE`, `newSignIn`, `liveSignIn`, `SIGN_IN_SECONDS`, `SignInPayload` | `src/shared/session.ts`, `domain/session.ts` | Nothing. The `Origin` check, the five-minute `auth_time` rule and a JSON-only body take the place of `state`/PKCE |
| The callback's claims, read without a signature check (OIDC Core 3.1.3.7) | `domain/session.ts` `checkIdClaims` | The signature is verified first, then claims are checked, now including `auth_time` and returning `name` |
| The tests of all the above | `sign-in.itest.ts` (whole file), `session.test.ts` and `shared/session.test.ts` (the sign-in-cookie cases) | `session.itest.ts` (new) and `cognito.test.ts` (new); the domain tests gain the `auth_time` and name cases |
| `COGNITO_DOMAIN` | `env.ts`, `env.test.ts`, `.env.example`, `ci.yml`, `docs/local-setup.md`, `infra/ssm.tf` (param), `infra/ecs.tf` (secret), `infra/outputs.tf` (output and list) | Nothing: no hosted pages |
| `COGNITO_CLIENT_SECRET` | the same files | Nothing: the new client is public |
| `COGNITO_CLIENT_ID` (confidential client `app`) | `infra/ssm.tf` | The same parameter, pointing at the new public client `web` |
| `cognito_callback_urls`, `cognito_logout_urls` | `infra/variables.tf` | Nothing: no OAuth redirect |
| "Sign in" links to `/v1/session/sign-in` | `src/app/page.tsx:53`, `src/app/docs/route.ts:24` | `/sign-in` |
| Local sign-in instructions that use Cognito's page | `docs/local-setup.md` §89–120 | Keel's `/sign-in` |
| "Cognito pool and callback URL" | `docs/adr/ADR-004-environments.md:140` | "Cognito pool and app client" |

The session cookie payload grows from `{uid, exp}` to `{uid, email, name, exp}`
(ADR-002). Cookies in the old shape are refused, so every open session ends once at
the release, and the person signs in again.

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/intents/I-04-…/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 2 | `infra/cognito.tf`, `infra/outputs.tf` | **Added**: `aws_cognito_user_pool_client.web`. It is public (`generate_secret = false`), with `explicit_auth_flows = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]`, no OAuth flows, scopes, callback or logout URLs, `prevent_user_existence_errors = "ENABLED"`, `enable_token_revocation = true`, `refresh_token_validity` at its 60-minute minimum, `read_attributes = [email, email_verified, name]` and `write_attributes = [email, name]`. **Pool, in place**: `verification_message_template` (`CONFIRM_WITH_CODE`, Keel's subject and wording, `{####}`). `name` is Cognito's standard attribute, so it is not required and there is no `schema` block, which would replace the pool. Output `cognito_web_client_id`. The old `app` client and the domain stay for now |
| 3 | `src/modules/session/domain/session.ts` (+ test) | `SessionPayload` becomes `{uid, email, name, exp}`, and `liveSession` checks the new shape. `checkIdClaims` adds `auth_time`: refused as `stale_sign_in` when `now − auth_time > 300`, and as `malformed` when it is missing. It returns `name` (or null). New: `displayName(name, email)`, which falls back to the part of the email before the `@` |
| 3 | `src/shared/session.ts` (+ test), `src/test/session.ts`, `src/test/fixtures.ts`, `src/modules/session/service.ts` | `sessionCookie` takes `{userId, email, name}`. New: `sessionOf(cookie, now, secret)` → `{id, email, name} \| null`, with `sessionUserId` built on it. `cookieFor` and `testUser` pass an email and name. The callback still works in this step and passes the claims' name |
| 4 | `src/modules/session/cognito.ts` *(new, + `cognito.test.ts`)* | `fetchSigningKeys(issuer)` (5 s timeout → `unavailable`) and `verifySignature(token, keys)` (RS256 only, `kid` must match). Unit-tested with a key pair generated in the test |
| 4 | `src/modules/session/service.ts`, `src/app/v1/session/route.ts` | `POST` runs, in order: `Origin` = `new URL(appBaseUrl).origin` → else 403; body `{id_token}` → else 400; keys → else 503; signature and claims → else 401 (reason logged as a type); find or create the user → 409 or 204 with `Set-Cookie`. `GET` reads `sessionOf` → 200 `SessionUser` or 401. `DELETE` unchanged |
| 4 | **Removed**: `src/app/v1/session/sign-in/route.ts`, `src/app/v1/session/callback/route.ts`, `src/modules/session/idp.ts`, `src/modules/session/sign-in.itest.ts`; the sign-in-cookie code and tests listed above | The contract on this branch already lacks these routes, so `contract-coverage.itest.ts` fails until they go: removal and replacement share one commit |
| 4 | `src/modules/session/session.itest.ts` *(new)*, `src/test/authorization-table.ts` | Every response `POST`/`GET /v1/session` declares. The `getSession` row |
| 4 | `src/config/env.ts` (+ test), `.env.example`, `.github/workflows/ci.yml`, `docs/local-setup.md` | `COGNITO_DOMAIN` and `COGNITO_CLIENT_SECRET` are no longer read; `cognito` is `{poolId, clientId}`. The deployed task still injects both until step 11, and they are ignored |
| 5 | `package.json`, `package-lock.json` | `aws-amplify`, exact version (approved in the spec). Rohit runs the install under Node 26 |
| 5 | `src/modules/session/browser.ts` *(new, `"use client"`, + test)* | The only file that imports Amplify. `configureAuth({poolId, clientId})` uses an in-memory key-value store (never `localStorage`). `signInToKeel(email, password)`: SRP `signIn` → `fetchAuthSession` → `POST /v1/session {id_token}` → Amplify `signOut()` (clears the store and revokes the refresh token) in a `finally` → on 204 a full navigation to `/`. Also `createAccount`, `confirmAccount`, `resendCode`, `startReset`, `finishReset`, each ending in `signInToKeel`. No `autoSignIn`: both paths end in the same sign-in |
| 6 | `src/modules/session/domain/authScreens.ts` *(new, + test)* | The screens' pure rules: email check and its three messages; the length counter (`0 of 12` / `9 of 12 · 3 more` / `✓ 20 characters`); the code sanitiser (digits only, six at most); the 60-second resend wait; Cognito error name → copy (wrong email and wrong password are one message) |
| 7 | `src/app/(auth)/layout.tsx`, `src/app/(auth)/auth.module.css`, `src/app/(auth)/AuthProvider.tsx` *(new)* | The shared hero and card layout, phone band and footer. The server layout reads `getConfig().cognito` and passes it to the client provider, so no value is baked into the build (ADR-004). The Keel Modern tokens are imported **only in this layout** (`docs/design/keel-modern-tokens.css` → `src/app/(auth)/tokens.css`), so Today's styling is untouched. A signed-in visitor is redirected to `/` |
| 7 | `src/app/(auth)/sign-in/page.tsx` (+ client form) *(new)*, `src/app/page.tsx`, `src/app/docs/route.ts` | The Sign in screen. Links go to `/sign-in` |
| 8 | `src/app/(auth)/create-account/page.tsx` (+ client form) *(new)* | Create account → Check your email (a step in the same page, holding email and password in component state) → sign in → `/` |
| 9 | `src/app/(auth)/reset-password/page.tsx` (+ client form) *(new)* | Steps 1 and 2 → sign in → `/` with the toast. The email carries over from Sign in in client memory, not in the URL or storage |
| 10 | `src/app/page.tsx`, `src/app/page.module.css` | "Signed in as {name}" and a **Sign out** button (`DELETE /v1/session` → `/sign-in`). Interim until the shell's account menu (`01-shell.md`) |
| 11 | `infra/cognito.tf`, `infra/ssm.tf`, `infra/ecs.tf`, `infra/variables.tf`, `infra/outputs.tf`, `docs/adr/ADR-004-environments.md` | **Removed**: client `app`, `aws_cognito_user_pool_domain.main`, SSM `cognito_domain` and `cognito_client_secret`, the two task-definition secrets, both `cognito_*_urls` variables, and the output `cognito_domain`. `/keel/COGNITO_CLIENT_ID` → `web.id`. ADR-004 wording |
| 12 | `docs/intents/TRIAGE.md` | Findings: the global Keel Modern tokens and fonts (design build-order step 1); a confirmed account should land in onboarding, not Today |

---

## Order of work

0. **Rohit revises and re-accepts `intent.md` and `spec.md`** for the screens. *(Done, 7743f05.)*
1. **Accept the plan.** `plan.md` committed alone.
2. **Infra, additive.** Commit `cognito.tf` with the new `web` client and the email
   template. Then **stop**: I run `terraform plan` and show it. Expected: 1 to add
   (`web` client), 1 to change in place (the pool), 0 to destroy. **Apply A** happens
   only after Rohit's go-ahead, and Rohit runs it.
   *Effect on the deployed service:* none. The running task keeps using the `app`
   client and the hosted pages. The only visible change is that a hosted-page sign-up
   now gets Keel's email wording. Nothing is destroyed.
   *Why a new client rather than editing `app`:* `generate_secret` forces replacement
   of the client. Replacing `app` in place would destroy it while the running code
   still needs it. A new client beside the old one means nothing breaks before the
   code that uses it is released.
   After Apply A, my local `.env` takes `COGNITO_CLIENT_ID` = `web`, so steps 5–10
   run against the real pool.
3. **The session carries email and name**, plus the five-minute rule. Domain first, then the cookie.
4. **The exchange replaces the redirect.** `cognito.ts`, `POST`/`GET /v1/session`, the
   Origin check, the removals, config. After this commit the branch has no way to sign
   in until step 7. `main` never sees that, because the PR merges whole.
5. **The browser module** (Amplify, in memory only).
6. **The screens' pure rules.**
7. **Auth layout and Sign in.** The first commit where the whole sign-in runs on localhost.
8. **Create account and Check your email.**
9. **Reset, steps 1 and 2.**
10. **Name and Sign out on Today.**
11. **Infra, the removals.** Commit, then **stop**: I show `terraform plan`. Expected:
    the `/keel/COGNITO_CLIENT_ID` value and the app task definition change (a new
    revision, which rolls the service); destroyed are client `app`, the pool domain
    `keel-<account>`, and SSM `/keel/COGNITO_DOMAIN` and `/keel/COGNITO_CLIENT_SECRET`.
    The pool, its accounts and the `user` table are not touched. **Apply B** runs only
    after Rohit's go-ahead, from `main`, **after the PR is merged and the release tag has
    deployed**, in this order:
    1. Rohit tags; the deploy rolls the new image. The task still reads the old client id from SSM, so **signing in fails** until Apply B. Sessions in the old cookie shape are refused, so Rohit is signed out once. No data is affected.
    2. Rohit runs Apply B straight away. The new task-definition revision rolls the service onto `:latest`, which is now the new image, and the new client id. Signing in works again after that roll (about 3–5 minutes).
    3. After Apply B, a pre-I-04 image can no longer run, because it requires the two removed variables. Rolling back past I-04 then also means re-applying the old infra.
12. **Live proof and triage** (below). Nothing is committed except the TRIAGE entries.

---

## Proof

Each commit passes `format:check`, `lint`, `typecheck`, `test:tz`, `contract`,
`build` and `commitlint`. Integration tests run in CI. The pure domain stays at 100%
coverage.

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 2 | `terraform plan` shows the pool **update in-place** (it is never replaced, so the name needs no new pool) and 0 destroyed | Additive. No code reads the new client yet |
| 3 | Domain: `auth_time` at `now − 300` is accepted; `now − 301` is `stale_sign_in`; missing is `malformed`. The name comes back; `displayName` falls back to the email's local part; the old `{uid, exp}` payload is refused. Cookie: round-trips `{id, email, name}` | The callback still issues valid cookies |
| 4 | `cognito.test.ts`: a good signature passes; a tampered payload, a foreign key, an unknown `kid`, `alg: none` and HS256 are refused. `session.itest.ts`, against real Postgres with the JWKS fetch replaced by a test key: **403** with no `Origin` or a foreign one, decided before any key fetch (the mock is never called); 400 for a bad body; 401 for each refusal (bad signature, wrong pool or client, access token, expired, unverified email, **sign-in older than five minutes**); 503 when keys can't be fetched, with a real never-answering server timing out within 5 s (NFR-08); 204 creates then reuses the user; 409 writes nothing. `GET` 200 returns the name, with the fallback for a null name; 401 otherwise. **Logs:** every case runs with `console.log`/`console.error` captured, and no line contains the token or any of its three segments. **Outage:** with global `fetch` made to reject, `GET /v1/session` and a `withSession` route (`GET /v1/day`) still answer 200 for a live cookie, so validation makes no network call. `contract-coverage` and `authorization` pass with the new `getSession` row | The contract and the code agree again. No sign-in surface until step 7, but no merge happens in between |
| 5 | `browser.test.ts`, with `aws-amplify/auth` mocked: the call order is signIn → fetchAuthSession → POST → signOut. The POST body is exactly `{id_token}`, same-origin, JSON. `signOut` runs even when the POST fails. After the flow, the in-memory store is empty. Amplify is configured with that store, never `localStorage`. Create and reset both end in `signInToKeel`. Nothing is exported that holds a token | — |
| 6 | `authScreens.test.ts`: every message and counter state in `02-auth-and-onboarding.md`; `UserNotFoundException` and `NotAuthorizedException` give the same copy | — |
| 7–10 | `npm run build`, and a **real image build** (`docker build`) once at step 7 (CLAUDE.md, *Common mistakes*: standalone output with Amplify) | Each screen works on its own |
| 11 | `terraform plan` as described; after Apply B, read-only checks through the AWS MCP: the pool has one client, no secret and no OAuth flows; `DescribeUserPool` shows no domain | — |

**The browser side, live.** Screens are now in scope, so the proof runs through them in
Chrome (claude-in-chrome), recorded as a GIF. It runs twice: on localhost against the
real pool after Apply A, then on the deployed service after Apply B. Before acting, a
throwaway recorder is installed through `javascript_tool` (not app code). For each
request it logs to the console the host, the `X-Amz-Target`, and the *names* of the
body's auth parameters, plus a yes/no for whether the body contains the typed
password. Never the values. Expected:

- **SRP:** `InitiateAuth` has `AuthFlow = USER_SRP_AUTH` with `SRP_A` and no `PASSWORD`; `RespondToAuthChallenge` is `PASSWORD_VERIFIER`. The password appears only in `SignUp` and `ConfirmForgotPassword`, which go to `cognito-idp.us-east-1.amazonaws.com`. **No request to Keel's origin contains it.**
- **The exchange:** one `POST /v1/session` whose body keys are `[id_token]` → 204, then `RevokeToken`, then the navigation to `/`.
- **Nothing left:** on `/`, `localStorage` and `sessionStorage` hold no key, and `document.cookie` shows nothing (`keel_session` is HttpOnly). Memory is covered by the full navigation, which discards the page's JavaScript heap, and by the revoked refresh token. If the recorder's console lines don't survive the navigation, Chrome's network log stands in for the request list.
- **No Cognito page:** no request goes to `*.amazoncognito.com`; after Apply B the domain no longer exists.
- **The journey:** create (with a name) → confirm with the emailed code → Today shows "Signed in as {name}" → sign out → sign in → reset → signed straight in. Reset with an address that has no account shows the same step 2. **The codes:** Rohit gives a test address and reads me the codes, unless he says I may read them from Gmail.
- **Origin, live:** `curl -X POST https://<cf>/v1/session -H 'Origin: https://evil.example' -H 'content-type: application/json' -d '{"id_token":"x"}'` → 403. No real token is needed, because the Origin is checked first.
- **Logs, live:** a CloudWatch Logs Insights query over `/ecs/keel` for the run's window finds no `eyJ` (a JWT's first characters) and not the test password.
- **Outage, live:** not repeated against production. The itest is the proof, together with the fact that `withSession` and `sessionOf` import nothing that makes network calls.

---

## Risks

*(Not interrogated: Rohit accepted the plan as drafted on 2026-10-21.)*
