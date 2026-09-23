# ADR-008 — Where scheduling logic lives

**Decision:** D-10 · **Story:** W4-09 · **Status:** Decided · **Date:** 2026-09-23

## Context

D-10 asked where the rules that turn a schedule into dated commitments should
live: in the database as generated rows, or in code as functions over the facts.

The ERD (revision 2) answered "stored rows" for one specific reason, and it is
worth quoting because this record reverses it:

> Deriving them looks cheaper — the segment already says which days are planned.
> But pause and resume mean the planned days are not a function of the schedule
> alone; they depend on the status timeline.

That reasoning was correct at the time. The status timeline was not recoverable,
so a slot could not be re-derived, so it had to be frozen. But it created two
places where the same truth lived: `plan_slot` rows generated at write time, and
`generateSlots` in `domain/`, which produced them. Two copies of one rule drift —
that is the failure ADR-001 exists to prevent, and NFR-09 already forbids storing
anything that can be counted.

`objective.status` had the same shape of problem. The status column and the
status history were both authorities on "is this paused", and nothing made them
agree.

## Decision

**Store the facts; compute everything that follows from them.**

The facts are:

- **commitments** — `objective`, `plan_segment`;
- **effort** — `effort_entry`;
- **status changes** — `status_event`.

Everything else follows from those: plan slots, review windows, adherence,
totals, streaks, extension counts, "the sentence that repeats".

Three things follow.

**`plan_slot` is dropped.** It held `generateSlots` output, which is a
derivation, not a fact. It was defensible only while pause history was
unrecoverable; storing status events makes slots re-derivable from
`(segment, status events)`.

**`status_event` is created in this sprint**, pulled forward from its later
story, because the decision above depends on it. Without it the derivation is
not possible and `plan_slot` has to stay.

**`objective.status` is dropped.** The current status is the latest status
event. Keeping both would move the dual-source-of-truth problem rather than
remove it.

**The rules live in `domain/` as pure functions** (ADR-001).
`generateSlots(segment, statusEvents)` takes values and returns values: no
database handle, no clock, no random source. No rule lives in a trigger, a
generated column or a view. **The service persists; the database constrains.**

## What the database still enforces, and what only code can

Dropping generated rows does not mean dropping integrity. It moves the line, and
the line is worth stating so nobody looks for a rule in the wrong layer.

**The database still enforces** — these are cheap, total, and cannot be bypassed
by a bug in a service:

- ownership, through foreign keys (`user` → `objective` → `plan_segment`,
  `effort_entry`, `status_event`), so no row is reachable without a user (NFR-10);
- presence — `plan_segment.reason` NOT NULL, and the rest of the NOT NULLs;
- domains — the enum types (`schedule_mode`, `review_cadence`, the status-event
  `change`);
- ranges — a segment's `end_date` is not before its `start_date`;
- **non-overlap** — the `EXCLUDE` constraint that stops two segments of one
  objective covering the same date (invariant 4);
- uniqueness — one draft review per objective and period, one user per email.

**Only code can enforce** — each of these is a rule over a *sequence*, which a
row constraint cannot see:

- slot generation itself: which days a segment plans, and the week rows a
  flexible segment produces;
- suppression while paused, and resumption — a function of the status timeline,
  not of any one row;
- contiguity, the "no gaps" half of invariant 4: the `EXCLUDE` constraint refuses
  an overlap but cannot require that segment *n* starts the day after *n−1* ends;
- review windows from a cadence, and every figure computed in one.

A rule in the second list is tested as a pure function, because that is the only
place it exists.

## The cost, accepted deliberately

**With nothing frozen, fixing a bug in `generateSlots` changes what the past
was.** An old review's adherence can shift under a corrected rule. The plan you
were held to last month is recomputed, not remembered.

This is accepted, for two reasons. It is already true: the ERD recomputes every
review figure when a review is opened (invariant 14), so review numbers were
never frozen. And the alternative is worse in the direction that matters — frozen
rows that a later bug fix cannot reach means the record keeps a number the system
now knows to be wrong, which is exactly the "counted twice" failure NFR-09 and
NFR-01 are about.

What is genuinely lost: there is no record of *what the plan said at the time*,
as distinct from what the rule says it said. If that is ever needed — an audit, or
wanting a review to be a signed statement rather than a live query — the answer
is to freeze a figure **into the review row** at save time, deliberately, as its
own decision. It is not a reason to keep generated rows.

## Consequences

**Good**

- One implementation of every scheduling rule, in `domain/`, where ADR-001 says
  it belongs and where ADR-007's tests can reach it without a database.
- Pause and resume stop being write-time bookkeeping ("generate slots, stop
  generating, start again") and become a read of the status timeline. The class of
  bug where a pause forgets to suppress a slot cannot occur.
- Two dual-source-of-truth pairs removed: slots against the generator, and
  `objective.status` against its history.
- Fewer rows, and NFR-09's budget gets quieter — 780 slot rows a year were the
  largest single source in the table.

**Costs accepted**

- The past is recomputed, not remembered (above).
- Every read that needs planned days now runs the generator. Today's read is one
  query plus a pure function over its rows, not a join to a slot table — NFR-03's
  budget is now partly a CPU budget rather than only a query-count budget.
- `status_event` becomes load-bearing: an objective with no `created` event has no
  status at all. The migration (W4-10) must backfill one per existing objective.

## Revisit when

- **The data stops being tiny** — NFR-09's ceiling (2,000 rows and 1 MB per user
  per year) is passed, so recomputation is no longer free.
- **A screen's computed read misses NFR-03's budget** (p95 300 ms for the day
  fetch, 1 s to interactive).

At that point caching a derivation becomes a measured trade rather than a guess.
And what gets added is **a cache** — invalidated, rebuildable, and never consulted
when the facts and the cache disagree. It is never a second source of truth.

- Also revisit if a reason appears to freeze the past deliberately (audit, or a
  review that must be a statement rather than a query). That is a decision about
  reviews, not about slots.
