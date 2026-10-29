# I-10 — Onboarding

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-10-29 · **Accepted:** 2026-10-29, revised and re-accepted the same day

## Intent description

A new account confirms its email and lands on an empty Today. Nothing says what Keel
is for or how its record works, and the first objective — the thing every other part
of Keel needs — is left for the user to find. The approved design starts a short
onboarding right after the email is confirmed: `docs/design/screens/02-auth-and-onboarding.md`.
This intent builds it, so a new user starts with an objective and knows what to do
each day.

## Proposed outcome

Right after confirming their email, a new user is shown how Keel works, creates their
first objective with the same form as New objective, and sees what it asks of them
before going to Today. They can skip at the first step and land on Today's empty card.
Onboarding is shown to an account until it creates an objective, or skips it in that
browser.

## How we know it worked

On the deployed service, a new account goes from confirming its email through the
three steps to Today, where its first objective is planned as set. A second new
account skips and lands on the empty card. Signing in again in the same browser, on
either account, never shows onboarding.

## Out of scope

Anything onboarding describes but Keel does not have yet: logging a deviation and
parking an idea. Starting from an approved idea. Flexible objectives (v2).
