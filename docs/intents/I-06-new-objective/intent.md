# I-06 — New objective

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-10-23 · **Accepted:** 2026-10-23

## Intent description

An objective can be created today only by calling the API. Nothing a user sees can
start one, so a new account has nothing to log against. The approved design has a
New objective page — `docs/design/screens/04-objectives.md`. This intent builds it,
so that starting an objective is something a user does in Keel, not something done
for them.

## Proposed outcome

From the Objectives page, a user opens New objective, says what it is and why it
matters, sets a fixed or flexible schedule and a plan, sees what that commits them to,
and creates it. An objective that starts today is then on Today.

## How we know it worked

On the deployed service, a signed-in user creates one fixed and one flexible
objective from the page, one starting today and one later. Each is stored exactly as
set, and the one that starts today shows on Today. Every mistake the design names is
caught on the page, in the design's words, before anything is sent.

## Out of scope

Starting from an approved idea — the "Start from" card waits for the Parking lot. The
Objectives list and detail. Today's redesign and its empty card. Onboarding.
