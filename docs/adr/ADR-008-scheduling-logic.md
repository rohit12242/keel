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

The facts scheduling reads are:

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

These are cheap, total, and cannot be bypassed by a bug in a service. Two lists,
because half of this schema does not exist yet and a record that blurs the two is
a wish rather than a statement.

**Enforced now** — in `migrations/1789536602458_initial-schema.cjs`, by
constraint name:

- ownership, through foreign keys (`user` → `objective` → `plan_segment`,
  `effort_entry`), so no row is reachable without a user (NFR-10);
- presence — `plan_segment.reason` NOT NULL (invariant 5), and the rest of the
  NOT NULLs;
- domains — the `schedule_mode` and `review_cadence` enum types;
- ranges — `plan_segment_dates` (`end_date >= start_date`) and
  `effort_entry_minutes`;
- **non-overlap** — `plan_segment_no_overlap`, the `EXCLUDE` constraint that stops
  two segments of one objective covering the same date (invariant 4);
- coherence within a row — `plan_segment_mode`, so a fixed segment has weekdays
  and a flexible one a day count;
- uniqueness — `plan_segment_seq_unique` (one segment per objective and `seq`),
  and `email citext NOT NULL UNIQUE`.

**Enforced after W4-10** — the expand migration this ADR requires. All of this
now exists (`migrations/1790236127275_add-status-event.cjs`):

- the `status_event` foreign key to `objective`, so status history cannot orphan;
- the status-event `change` enum (`created`, `paused`, `resumed`, `completed`,
  `ended`);
- `status_event_one_created_idx`, a partial unique index giving at most one
  `created` event per objective — half of invariant 16, and the half a constraint
  can hold;
- `plan_segment_days_per_week`, `plan_segment_planned_weekdays`,
  `plan_segment_minutes_positive`, `plan_segment_seq_non_negative` — ranges the
  ERD names in words and W3-12 missed;
- `plan_segment_contiguous`, the exception below.

**What is dropped later, not by W4-10.** `plan_slot` and its constraints,
`objective.status`, and the `objective_status` and `period_kind` types stay until
they can go. **W4-29 moved the readers** — Today and the effort write compute the
covering slot and read the status from `status_event`, nothing writes `plan_slot`,
and `PlanSlot.id` left the contract (G-15, closed). **W4-30 drops them**, with no
reader left to break. Expand, migrate, contract (ADR-004).

Invariant 9 is the one that loses a database constraint in that trade —
`plan_slot_unique` goes and nothing replaces it, because a value cannot carry a
unique index. It becomes a tested property of `generateSlots` instead.

Later still, with the review table (E-05): one draft review per objective and
period.

**Only code can enforce** — each of these is a rule over a *sequence*, which a
row constraint cannot see:

- slot generation itself: which days a segment plans, and the week rows a
  flexible segment produces;
- suppression while paused, and resumption — a function of the status timeline,
  not of any one row;
- review windows from a cadence, and every figure computed in one.

### Amendment (W4-10): contiguity is enforced by a constraint trigger

This record first listed contiguity — the "no gaps" half of invariant 4 — as
code-only, on the grounds that a rule over a sequence cannot be a row constraint.
That much is still true: it is not expressible as a `CHECK`. The conclusion drawn
from it was wrong.

W4-10 adds `plan_segment_contiguous`, a `DEFERRABLE INITIALLY DEFERRED`
constraint trigger that re-checks one objective's segments at COMMIT and refuses a
gap. **This is a deliberate exception to "no rule lives in a trigger", and the
only one.** The reasoning:

- The rule is an *integrity* rule, not a scheduling rule. It says the stored facts
  are well-formed, which is the database's job. It computes nothing and it is not
  a rule any screen reads — so it does not create a second implementation of
  anything in `domain/`.
- The half-enforced alternative is worse. `plan_segment_no_overlap` already stops
  two segments covering one date; leaving the gap case to a service means the
  database guarantees half an invariant, which is the kind of split that reads as
  enforced and is not.
- A gap is silent and unrecoverable by inspection: the objective simply has a
  stretch with no plan, and every figure over that window is quietly wrong.

The boundary this keeps: a trigger may refuse a write that would make the facts
inconsistent. **A trigger may never compute a derivation, fill a column, or hold a
rule a screen reads.** Slot generation, pause suppression, review windows and
every figure stay pure functions in `domain/`. Any further trigger has to clear
that same line and be recorded here — nothing automated enforces that, so this
paragraph is the whole guard.

**What the trigger does not cover**, so it is not mistaken for the whole of
invariant 4:

- It orders by `start_date`, so it enforces that the *dates* leave no gap. It does
  not tie `seq` order to date order: seq 0 covering October with seq 1 covering
  September passes every constraint in the schema. Invariant 4's wording
  ("segment *n* starts the day after segment *n−1* ends") is therefore still
  half a code rule.
- `seq` is checked as `>= 0`, not as gapless from 0. Extension count is
  `count(*)`, so a gap in `seq` would make "Extension 2" and "extended 3 times"
  disagree. Also code's job.

**Append-only on `status_event` is a convention, not a constraint** (W4-10). The
table has no trigger and no revoked grant; nothing stops an `UPDATE` or `DELETE`.
The recommendation, when it is worth enforcing: **revoke the grants**
(`REVOKE UPDATE, DELETE ON status_event FROM <app role>`) rather than add a second
trigger. It is declarative, it costs nothing at write time, and it does not put a
rule in a trigger — the exception above stays the only one. It needs a distinct
application role first, which Keel does not have yet (one connection string, the
owner), so it lands with E-06's hardening. The same argument will apply to
`effort_entry` and `parked_idea_verdict` (invariant 13).

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
- **A reason appears to freeze the past deliberately** — an audit, or a review
  that must be a statement rather than a query. That is a decision about reviews,
  not about slots.

On the first two, caching a derivation becomes a measured trade rather than a
guess. And what gets added is **a cache** — invalidated, rebuildable, and never
consulted when the facts and the cache disagree. It is never a second source of
truth.
