# I-02 — Building the remaining backend of Keel

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-10-10

## Intent description

Keel's backend is a quarter built. I-01 made objectives real: one can be declared,
listed, opened, and its schedule read. Effort can be logged against an objective and
a day can be read back. Everything else the contract describes is still only
described.

This intent builds the rest. The product's claim is that the record decides what to
do next, and a record that holds only effort cannot do that. The deviations that
pulled you off the plan, the ideas you parked instead of chasing, the reviews that
judge a window and the status changes that end or extend an objective — those are
the parts that turn a log of hours into something worth reviewing. The patterns are
the vocabulary a deviation is classified against, and the session is what makes any
of it yours.

## Proposed outcome

Every operation in `docs/keel-api.yaml` is implemented and behaves as the contract
says. A user can log in, run objectives, log effort and correct it, declare and
classify deviations, park ideas and later judge them, review a window and record what
it concluded, and pause, resume, extend, complete or end an objective — all through
the API, with no screen required.

## How we know it worked

The contract has no operation without an implementation. A single run against the
deployed service can take an objective from created to completed, with effort,
deviations, parked ideas and a review attached, and read the whole story back.
Nothing is stored that the ERD says is computed.

## Out of scope

Screens. Anything the product brief lists as not in v1. Offline logging (NFR-06).
