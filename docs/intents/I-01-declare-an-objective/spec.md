# Spec — I-01 · Declare an objective

**Intent:** `intent.md` in this folder · **Status:** Drafted · **Written:** 2026-10-06

## Scope decisions taken here

These bind this intent only. Rules that outlive it are recorded where they belong,
and listed under *Design recorded elsewhere* below.

| | Decision | Why |
|---|---|---|
| S1 | **Both schedule modes are built.** A flexible segment plans a count of days per week, so slot generation gains week rows | The intent asks for both, and the contract already offers `flexible`. Today slot generation throws on a flexible segment, so a flexible objective would render as unplanned with every entry marked extra — a wrong answer, not a missing feature. |
| S2 | **`next_review_on` is omitted** from the reads | Optional and nullable, and the rule that computes it — specified in `docs/domain/review-windows.md`, unimplemented — is not in this intent. Omitting is legal; guessing is not. |
| S3 | **`committed_minutes_per_week` is omitted** | Optional, and no caller in this intent needs a cross-objective figure. |

## What must be true

**Creating one**

- An objective, its first plan segment and its `created` status event are written in
  one transaction: all three or none. The database enforces *at most one* created
  event; *at least one* is the service's guarantee, and an objective without it has no
  status at all.
- **The request carries the day the objective starts and the caller's zone.** It
  carries neither today, so a start date could come only from the server clock — the
  NFR-12 failure `local_date` exists to prevent. Same shape as the effort write, so
  there is one spelling of the idea; required, with no default, because an optional
  date here is a server clock with extra steps.
- `runs_for_days` counts inclusively from that day, so a one-day objective starts and
  ends on the same date.
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
- The stored facts say `created` and `resumed`; the contract's status says neither.
  Both read as `active`, and the mapping is stated in the contract rather than left to
  each reader.
- Neither read fans out per row. This is Keel's first list read, and NFR-03's reason
  applies even where its letter does not.

**The schedule**

- One day per date in range, each in exactly one of the five contract states, each
  naming the segment it falls in so a later extension renders correctly across the
  boundary. `off_day_worked` is a real state, not an error.
- Computed in one server read, never a request per day. Bounded by
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

Rules this intent needs that outlive it are written where the next intent will look.

| Rule | Recorded in |
|---|---|
| Segment 0's `reason` is the objective's `why_now` | `docs/erd.md`, `plan_segment.reason` |
| A read that meets an objective with no status events fails loudly | `docs/erd.md`, invariant 16 |

The two contract rules above — the start date and zone on the request, and
`created`/`resumed` reading as `active` — are recorded in `docs/keel-api.yaml` itself,
in the `description` of the fields they govern. The contract is the source of truth for
the contract; a second copy would drift from it.

## Areas of concern

- **C1 — the schedule needs `effort_entry`, which belongs to another module, and
  there is no rule covering that.** ADR-001 puts SQL only in `repo.ts`; it does not
  say whether a repo may read another module's tables. Either answer works — read it
  directly and never write it, or have the owning module expose a read — so **the
  choice is the implementer's**.

  What is not optional is making it visible. This binds every module after this one,
  so the plan names which way it went and why, and the same pull request records it as
  an amendment to ADR-001. A rule this size should not arrive as a line in a query.

## Out of scope

Status changes — pause, resume, complete, end. Review dates. The New-objective
preview panel. Extensions. Every screen.
