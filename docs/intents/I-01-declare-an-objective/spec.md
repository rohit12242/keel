# Spec — I-01 · Declare an objective

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-10-06 · **Accepted:** 2026-10-07

The design this needs is already in the repository — `docs/keel-api.yaml`,
`docs/erd.md`, `docs/adr/`, `docs/nfrs.md`, all named by CLAUDE.md. This file does not
repeat them.

## What must be true

**Creating one**

- An objective, its first plan segment and its `created` status event are written in
  one transaction: all three or none. The database enforces *at most one* created
  event; *at least one* is the service's guarantee, and an objective without it has no
  status at all.
- An inconsistent schedule is refused before any write, with the contract's `400` and
  a reason — never a constraint violation surfacing as a 500.
- The response carries the figures a brand-new objective has: nothing logged, against
  a real target.
- No slot is written anywhere.

**Reading them back**

- The list returns the caller's objectives, filtered by the `status` parameter, each
  with its current status, its schedule and label, its derived dates and its figures.
- Opening one adds the segments and the status history, merged by date so that adding
  extensions later changes the data and not the shape.
- Neither read fans out per row. This is Keel's first list read, and NFR-03's reason
  applies even where its letter does not.
- `next_review_on` and `committed_minutes_per_week` are omitted. Both are optional,
  and the rules behind them are not in this intent — omitting is legal, guessing is
  not.

**The schedule**

- One day per date in range, each in exactly one of the five contract states, each
  naming the segment it falls in so a later extension renders correctly across the
  boundary. `off_day_worked` is a real state, not an error.
- Computed in one server read, never a request per day. Bounded by `from` and `to`,
  defaulting to the objective's own span.

**Both schedule modes**

- A flexible run that does not divide into whole weeks ends in a short week, and that
  week cannot ask for more days than it contains.

## Out of scope

Status changes — pause, resume, complete, end. Review dates. The New-objective
preview panel. Extensions. Every screen.
