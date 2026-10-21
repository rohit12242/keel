# Spec — I-04 · Sign in on Keel's own screens

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-10-21 · **Revised and accepted:** 2026-10-21

The design this needs is in the repository: ADR-002 (revised for this intent),
`docs/keel-api.yaml` (`POST /v1/session`) and the screens in
`docs/design/screens/02-auth-and-onboarding.md`. This file does not repeat them.

## What must be true

**Keel's own screens**

- Sign in, Create account, Check your email, and Reset password (both steps) behave
  and read as designed in `02-auth-and-onboarding.md`.
- These screens use the Keel Modern look. The rest of the app keeps its current look
  until the app-shell intent.
- A newly confirmed account lands on Today; onboarding comes later.
- Today shows who is signed in and a way to sign out, until the app shell's account
  menu replaces it.

**The password stays out of Keel**

- Keel's server never receives a password. Sign-in proves it to Cognito from the
  browser with SRP; creating an account, confirming it with the emailed code and
  resetting a password go from the browser to Cognito directly.
- No password, ID token or Cognito token appears in Keel's logs, error reports or
  request traces.
- Sign-in and reset never reveal whether an address has an account. Creating one may,
  as it must to say the address is taken.

**Turning a sign-in into a session**

- A session is created only from a sign-in that has just happened, only from Keel's
  own origin, and only for a verified email.
- Confirming a new account's email ends signed in, and so does resetting a password:
  both finish with the same sign-in and exchange. There is no second way to get a
  session.
- Cognito's managed login pages and its OAuth redirect are no longer used, and the
  app client can no longer be signed in through them.
- The two redirect endpoints are gone; no route, test or document still points at
  them.

**Who is signed in** (G30)

- Creating an account asks for a name, kept at Cognito, not in Keel.
- Every page, and `GET /v1/session`, knows the signed-in user's name without a
  database read. A rename shows at the next sign-in. An account with no name shows
  the part of its email before the `@`.
- The pool does not have to be replaced to add the name.

**Nothing kept in the browser**

- Once the exchange answers, the browser holds no Cognito token — none in
  `localStorage`, `sessionStorage`, cookies or memory — only Keel's own session cookie.
- Signing out leaves the same: nothing but a cleared cookie.

**The emails say they are from Keel**

- The confirmation and reset emails are one Keel-worded email, because Cognito has a
  single code template: it names Keel, gives the 6-digit code, and states both
  expiries — 24 hours to confirm, an hour to reset. It is still sent from Cognito's
  own address.

**What does not change**

- The session: its cookie, its lifetime, and validation with no network call, so a
  Cognito outage still does not end an open session (NFR-08).
- Authorisation: every request is the caller's, and every query is scoped to them
  (NFR-10).
- One build runs in every environment: the browser learns which Cognito pool and
  client to use from the server at runtime, not from values baked into the build
  (ADR-004).

**Approved here**

- `aws-amplify` (Auth only), version pinned, as a runtime dependency — CLAUDE.md asks
  for pre-approval, and accepting this spec gives it.

## Out of scope

Onboarding. The app shell and the Keel Modern look outside the sign-in screens. MFA.
Social sign-in. Separate confirmation and reset emails, which need a CustomMessage
Lambda (considered 2026-10-21, not chosen). Sending the emails from Keel's own
address, which needs Amazon SES and a verified domain.
