# I-16 — Parking lot

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-11-04 · **Accepted:** 2026-11-04

## Intent description

A new idea is the most common thing that pulls effort off a plan. Keel's answer is to
park it: write down the idea and why it grabbed you, keep it locked until the
objectives running that day have ended, then decide on it — take it as an objective,
or drop it and say why. The lock, the verdicts and the notes exist in the backend, but
an idea can be parked only through the API, and New objective cannot start from one.
The approved design is `docs/design/screens/07-parking-lot.md`, with Park an idea on
Today and the "Start from" card in New objective. This intent builds them.

## Proposed outcome

From Today or the Parking lot, a user parks an idea and sees when it opens. The
Parking lot lists every idea with its state: locked, open, approved, taken or dropped.
A user approves an idea or drops it with a reason, early or not, adds notes to it, and
starts a new objective from an approved idea, which then becomes Taken.

## How we know it worked

On the deployed service, a user parks an idea while an objective is running and sees
it locked until that objective's end. They approve it, start an objective from it in
New objective, and find it Taken with the objective's dates. They park a second idea
and drop it with a reason; a decision made before the lock lifts reads as early. Notes
added to both show newest first.

## Out of scope

Changing the lock rule. Reviving a dropped or taken idea — both verdicts are final.
Parked ideas inside reviews.
