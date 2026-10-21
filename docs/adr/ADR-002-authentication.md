# ADR-002 — Authentication approach

**Decision:** D-07 · **Status:** Decided · **Date:** 2026-09-15 · **Revised:** 2026-10-21 (I-04)

**Identity is delegated to Amazon Cognito. The session belongs to Keel.**

## Who owns what

| Concern | Owner |
|---|---|
| Credentials, account creation, password reset, lockout, rate limiting | Cognito |
| The sign-in, create-account and reset **screens** | Keel — they render the form; the browser talks to Cognito |
| The session cookie, its lifetime, every authorisation check | Keel |

Keel renders the screens but **never receives, stores or compares a password**: the
browser proves the password to Cognito itself, so Keel's server has no endpoint that
takes one. Cognito's configuration lives in `infra/` with the rest of the deployment.
*(Revised in I-04. Until then the screens were Cognito's managed login pages.)*

## Signing in

The browser talks to Cognito through the **Amplify Auth** library, against Keel's own
screens. Cognito's managed login pages and its OAuth redirect are not used.

1. **Prove the password — browser to Cognito.** Sign-in uses SRP (`USER_SRP_AUTH`):
   the browser proves it knows the password without sending it, and Cognito returns
   tokens. Creating an account (with its emailed code) and resetting a password go
   from the browser to Cognito the same way, and **both end by signing in** — SRP,
   then step 2. There is no other way to get a session.
2. **Exchange — browser to Keel.** `POST /v1/session` with the ID token. Keel checks it
   locally against Cognito's published keys: signature, issuer, audience,
   `token_use = id`, not expired, **authenticated within the last five minutes**, and
   email verified. It finds or creates the local user and sets the session cookie.
3. **Drop the tokens.** The browser keeps Cognito's tokens **in memory only** —
   Amplify configured never to write them to storage — and discards them, refresh
   token included, as soon as the exchange answers.

The five-minute limit is what stops a leaked ID token, valid for an hour, from being
turned into a seven-day session: only a sign-in that has just happened can be
exchanged.

`DELETE /v1/session` signs out by clearing the cookie.

The provider is contacted only at step 1, and Keel fetches its keys at step 2. Sign-in
fails while Cognito is down; an open session does not.

## The session

- A signed, HttpOnly cookie, `keel_session`, with a real expiry of at least seven
  days (NFR-08). It carries the user's id, email and **name**, copied from the ID
  token at the exchange, so a page knows who is signed in without a database read.
  A rename at Cognito shows at the next sign-in.
- Validated locally on every request, with no network call.
- **Never a token kept in JavaScript.** Cognito's tokens exist in the browser only
  between step 1 and step 3 above, in memory. Never in `localStorage` or any other
  storage, never sent as a Bearer header. Server components must know who is asking
  from the cookie on the document request, or every page renders empty and then
  fetches (D-04, NFR-03).

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
