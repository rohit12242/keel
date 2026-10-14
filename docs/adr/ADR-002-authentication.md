# ADR-002 — Authentication approach

**Decision:** D-07 · **Status:** Decided · **Date:** 2026-09-15 · **Revised:** 2026-10-12

**Identity is delegated to Amazon Cognito. The session belongs to Keel.**

## Who owns what

| Concern | Owner |
|---|---|
| Credentials, account creation, password reset, lockout, rate limiting | Cognito |
| The session cookie, its lifetime, every authorisation check | Keel |

Keel never receives, stores or compares a password, so the contract has no endpoint
for creating an account or resetting one. Cognito's configuration lives in `infra/`
with the rest of the deployment.

## Signing in

OIDC authorization code flow with PKCE, against Cognito's managed login.

1. `GET /session/sign-in` — Keel stores `state` and the PKCE verifier in a
   short-lived HttpOnly cookie and redirects to Cognito.
2. The user signs in at Cognito, which redirects back.
3. `GET /session/callback` — Keel checks `state`, exchanges the code, finds or creates
   the local user, sets the session cookie and redirects to Today.

`DELETE /session` signs out by clearing the cookie.

The provider is contacted **only** at step 3. Sign-in fails while Cognito is down;
an open session does not.

## The session

- A signed, HttpOnly cookie, `keel_session`, with a real expiry of at least seven
  days (NFR-08).
- Validated locally on every request, with no network call.
- **Never a token in JavaScript.** Not in `localStorage`, not sent as a Bearer
  header. Server components must know who is asking from the cookie on the document
  request, or every page renders empty and then fetches (D-04, NFR-03).

## The local user

Keel keeps its own `user` row, keyed by Cognito's subject id in `idp_subject`. Every
Keel row points at `user.id`, never at the subject, so changing provider re-maps one
column rather than re-keying the database. A first sign-in creates the user; there is
no matching by email (`docs/erd.md`, *User*).

Users therefore live in two systems: exporting or deleting an account has to cover
both.

## Revisit when

- Keel has more than one user and the bill becomes visible.
- Cognito changes its pricing or its terms.
- MFA or social sign-in is wanted.
- The deployment moves off AWS — Cognito's main advantage was being in the same cloud.
