# I-02 — Building the remaining backend of Keel

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-10-10

## Intent description

Keel's backend is a quarter built. I-01 made objectives real: one can be declared,
listed, opened, and its schedule read. Effort can be logged against an objective and
a day can be read back. Everything else the contract describes is still only
described.

This intent builds the rest.

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
