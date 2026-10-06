# Spec — I-01 · Declare an objective

**Intent:** `intent.md` in this folder · **Status:** Drafted · **Written:** 2026-10-06

## Scope decisions taken here

These bind this intent only. Rules that outlive it are recorded where they belong,
and listed under *Design recorded elsewhere* below.

| | Decision | Why |
|---|---|---|
| S1 | **Both schedule modes are built.** A flexible segment plans a count of days per week, so slot generation gains week rows | The intent asks for both, and the contract already offers `flexible`. Closes **G-17**. |
| S2 | **`next_review_on` is omitted** from the reads | Optional and nullable, and the rule that computes it (**G-06**) is not in this intent. Omitting is legal; guessing is not. |
| S3 | **`committed_minutes_per_week` is omitted** | Optional, and no caller in this intent needs a cross-objective figure. |

## What must be true

**Creating one**

- An objective, its first plan segment and its `created` status event are written in
  one transaction: all three or none. The database enforces *at most one* created
  event; *at least one* is the service's guarantee, and an objective without it has no
  status at all.
- `runs_for_days` counts inclusively from the day the user says it starts, so a
  one-day objective starts and ends on the same date.
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
- An objective belonging to someone else is **404, not 403**.
- Neither read fans out per row. This is Keel's first list read, and NFR-03's reason
  applies even where its letter does not.

**The schedule**

- One day per date in range, each in exactly one of the five contract states, each
  naming the segment it falls in so a later extension renders correctly across the
  boundary. `off_day_worked` is a real state, not an error.
- Computed in one server read — the fan-out **G-03** exists to prevent. Bounded by
  `from` and `to`, defaulting to the objective's own span.

**Both schedule modes**

- A fixed segment plans weekdays; a flexible one plans a count of days per week.
- A flexible run that does not divide into whole weeks ends in a short week, and that
  week cannot ask for more days than it contains.

**Throughout**

- Every query filters by the caller *(NFR-10)*.
- Every failure path is exercised by a test, not merely declared *(NFR-07)*.
- Nothing derived is stored and no request body accepts a derived value *(NFR-09)*.
- No note, reason or `why_now` reaches a log line or an error report *(NFR-11)*.
- New domain code is fully covered *(ADR-007)*, and the date maths is identical under
  `npm run test:tz` *(NFR-12)*.

## Design recorded elsewhere

Three rules this intent needs outlive it, so they are written where the next intent
will look rather than here.

| Rule | Recorded in |
|---|---|
| The create request carries the day the user means plus their zone | **G-19**, `docs/api-gaps.md` — closed by this intent |
| `created` and `resumed` both read as `active` | **G-20**, `docs/api-gaps.md` — closed by this intent |
| Segment 0's `reason` is the objective's `why_now`, and a read that meets an objective with no status events fails loudly | `docs/erd.md` — `plan_segment.reason`, and invariant 16 |

## Areas of concern

- **C1 — two policies pull opposite ways on G-19 and G-20.** CLAUDE.md says never
  change an endpoint without changing the contract in the same commit.
  `api-gaps.md` says record the gap rather than inventing a fix. Only doing both
  satisfies them: the gaps are recorded now and closed by this intent's contract
  change. Recording without fixing would leave the intent unbuildable; fixing without
  recording would lose why the field exists.
- **C2 — the schedule needs `effort_entry`, which belongs to another module, and
  there is no rule covering that.** ADR-001 puts SQL only in `repo.ts`; it does not
  say whether a repo may read another module's tables. This is an architecture rule
  that will bind every module after this one, so it is **not this intent's to settle**
  — it needs a decision with a home of its own. Open with Rohit before planning.

## Out of scope

Status changes *(G-16)*. Review dates *(G-06)*. The New-objective preview panel
*(G-09)*. Extensions. Every screen.
