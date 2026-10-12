# Spec — I-02 · Building the remaining backend of Keel

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-10-10 · **Accepted:** 2026-10-12

The design this needs is in the repository — `docs/keel-api.yaml`, `docs/erd.md`,
`docs/adr/`, `docs/nfrs.md`, `docs/domain/`. This file does not repeat them. Writing it
changed four of them; those changes are in the same commit.

## What must be true

**Signing in**

- Keel never receives, stores or compares a password. Creating an account, resetting
  a password and lockout happen at the provider (ADR-002), and the provider's
  configuration lives in `infra/` like the rest of the deployment.
- The first sign-in on the deployed database lands on the record that is already
  there, not on a new, empty user.
- A signed-in session keeps working while the provider is unreachable (NFR-08).
- The deployed service is reached only over HTTPS, on the registered domain ADR-006
  requires; plain HTTP redirects to it. No credential and no entry crosses the wire in
  clear (NFR-11). ADR-006 made this the precondition for sign-in, and the deployment
  is still HTTP-only today.

**The contract, usable from a browser**

- Every operation is served under `/v1`, as the contract's `servers` says — the six
  routes already live move there. The health check stays at `/health`, where the load
  balancer and the deploy look for it.
- The contract is served as an interactive page on every environment, local and
  deployed. It is rendered from `docs/keel-api.yaml` itself, never a copy, and each
  operation can be sent to the server the page came from.
- The page acts as whoever is signed in. Signed out, every protected request gets the
  contract's `401`, so the page exposes nothing a visitor could not already read in
  the repository.
- On the deployed page a request is a real write into the real record, and the record
  deletes nothing. That is stated on the page, not left to be discovered.
- The page is a runtime dependency, approved here: `swagger-ui-dist`, version pinned
  and served by the app itself — never loaded from a third-party origin, because the
  page runs on the same origin as the session.

**Every request is the caller's**

- No route takes its user from configuration any more. Every request without a valid
  session is refused, except the health check and the two sign-in steps.
- Every read and write that reaches a review, a deviation, a pattern, a parked idea or
  a verdict is scoped to the caller. The tables that carry no `user_id` reach the user
  through their parent, and nothing in the schema will catch a query that forgets to
  (NFR-10).

**Writing the record**

- A write that changes more than one table changes all of them or none: an objective
  started from a parked idea, a plan-end review saved with an outcome, an extension.
- Status events and verdicts are only ever appended. Nothing is deleted except an
  effort entry and a review that is still a draft.
- Every recorded date is the one the client sent. Where the server compares with
  today, it uses the user's zone — the contract states the rule once, for every
  operation.

**The objective's story**

- An objective can be paused, resumed, completed and ended, and only in an order that
  follows from where it is.
- A plan-end review's outcome is applied, not just written down, so what the review
  says and what the status history says can never disagree (ERD, invariant 7).
- An extension is authorised by exactly one plan-end review that chose to continue,
  and its new end date must fall after the day it is created — one already in the
  past is refused, not adjusted.

**Reviews**

- The server decides which period is due; the client never names a window
  (`docs/domain/review-windows.md`).
- A review's figures are computed every time it is opened. Saving stores the answers
  only, and a review cannot be saved while a chosen deviation in its period is
  unjudged.
- A deviation names the objectives it pulled you off — one or several, the user's
  choice — and shows in the reviews of each of them (ERD, invariant 11).
- A chosen deviation is judged once, by the first review of one of its objectives
  whose period holds it, and no later review changes that.

**The parking lot**

- An idea is locked by the rule in `docs/domain/parking-lock.md`, and the lock is
  fixed when the idea is parked.
- A locked idea cannot be judged, but it can be taken — and a reader can tell it was
  taken early.

**What I-01 left out**

- `next_review_on`, `committed_minutes_per_week` and the objective's criteria verdict
  are now returned, by the rules the domain documents and the contract give them.
- Each objective says how many reviews it owes, not only when the oldest fell due.
- The objective's effort can be read a month at a time.

**Reading it all back**

- No list read fans out per row — the reviews list, the deviations and their costs,
  the patterns and their counts, the parking lot (NFR-03).
- Nothing is stored that the ERD says is computed.

## Out of scope

Every screen, including the look of the provider's login page. Exporting or deleting
an account, which now spans two systems (ADR-002). MFA. Seeding a starter set of
deviation patterns. Checking responses against the contract automatically — the page
shows drift to a person; it does not fail a build. A sandbox to send requests to.
