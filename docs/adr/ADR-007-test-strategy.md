# ADR-007 — Test strategy, and what will not be tested

**Decision:** D-08 (revisited) · **Story:** W3-23 · **Status:** Decided · **Date:** 2026-09-18

## Context

D-08 originally chose "a coverage target across the codebase". The framing sheet
had listed coverage percentage as a **rejected criterion**, for the same reason
runtime speed was rejected in D-02: any number can be hit by testing the easy
things, so it does not discriminate between a suite that catches date bugs and one
that does not.

W3-23 revisits it. The cost objection to a high coverage target is gone — an agent
writes the tests — but cost was never the problem, and an agent asked for 80%
produces 80% by covering whatever is cheapest, which makes the discrimination
problem slightly worse. So a flat coverage number is still the wrong gate.

Two kinds of test earn their place, and they prove different things:

- **Domain unit tests** prove the *logic* is right — that `adherence`, `localDayOf`
  and the rest return the correct answer on their edge cases. They run in
  milliseconds and are worth demanding in full.
- **End-to-end journey tests** prove the *wiring* is right — that a request travels
  from the screen, through the service, into Postgres and back out onto another
  screen with the same meaning. **Domain tests are structurally blind to this
  layer.** The one bug this project has already hit — `pg` returning a `DATE`
  (OID 1082) as a JS `Date` at local midnight, moving an entry a day — lives
  entirely in the wiring. No amount of domain coverage would have caught it; a
  journey that logs a day and reads it back would.

So D-08 lands on both: the domain proven exhaustively, plus a small, fixed set of
real journeys exercised through the full stack. Coverage stays advisory everywhere
else, because it measures how much code ran, not whether it is right.

## Decision

**Two blocking layers, and coverage advisory everywhere else.**

| Scope | Rule | Why |
|---|---|---|
| `src/**/domain/**` | **100% branch coverage, blocking** | Pure functions, no I/O. Every branch is a business rule. An uncovered branch here is a rule with no test. |
| A fixed set of journey tests | **All must pass, blocking** | Each runs a real journey through the real stack and catches the wiring bugs the domain layer cannot see. Named below; the set is small on purpose. |
| Everything else | **Reported on the pull request, never blocking** | Measures how much code ran, which is a different question from whether it is right. |

Global coverage is still reported, because it is good at exactly one thing:
noticing that a whole module has no tests at all. It simply does not gate a merge.

### The journey tests that gate

The flow map defines **twelve journeys** (Flow map v2, *Journeys* tab). NFR-13
already walks all twelve by keyboard once per release — that manual walk is the
full-coverage check. **Automated end-to-end tests are a subset**, chosen so that
between them they exercise every seam a wiring bug hides in: session, persistence
round-trip, the aggregate read, and cross-session state. Kept to four so the suite
stays inside the pipeline's five-minute budget (ADR-003).

| # | Journey | Rows | What it proves that a domain test cannot |
|---|---|---|---|
| J1 | First run → create the first objective → Today | T06 → T16 → T27 | Account creation, the session cookie, and the Today aggregate query — the whole spine, once. |
| J2 | Daily log — the hot path | T08 | An entry survives the round-trip to Postgres and comes back on the **correct local day**. This is the OID 1082 guard. |
| J6 | Review date arrives → review → saved | T67 → T31 → T47/T48 → T49 | A review writes, and the review-window and adherence reads on the far side see it. |
| J10 | Leave a review half-finished and come back | T31 → T51 → T71 → T44 → T49 | Draft state that lives **between screens and across a session** — exactly the state a unit test cannot hold. |

The other eight journeys are covered by the NFR-13 keyboard walk, not by an
automated blocking test. If a wiring bug ever lands in one of them, the fix is to
promote that journey into this table with the defect named as the reason — the same
rule the "will not be tested" list carries.

### The checks that actually gate

In rough order of how sharply each one discriminates — coverage is last because it
is the weakest:

1. **The four journey tests above**, green, against a real Postgres. *(J2 also
   carries the NFR-12 date guard.)*
2. **NFR-12's four-timezone run** — the suite passes identically under UTC,
   Asia/Kolkata, Pacific/Kiritimati and America/Los_Angeles. *(W3-19)*
3. **NFR-01's restore drill** — back up, drop, restore, diff, once per release.
4. **NFR-13's keyboard walk and contrast scan** — all twelve journeys, both themes.
   *(E-06)*
5. **NFR-07's failure-response assertion** — no operation ships with only a happy
   path. *(W3-10)*
6. Domain branch coverage at 100%.

### Named edge cases per domain rule

Coverage says a branch ran. These say the right answer came out. Each rule owns
its list, and the list is part of the rule's story, not left to judgement:

| Rule | Cases that must have tests |
|---|---|
| `generateSlots` | month boundary · week starting mid-period · flexible week straddling the end date · a segment of one day · pause and resume inside a week |
| `adherence` | zero slots · zero entries · logged exceeding target · a flexible week counted by days not minutes · a paused stretch |
| `localDayOf` | 23:55 and 00:30 local · the four server zones · a date at the run's first and last day |
| `canExtend` | new end date in the past · no authorising review · review already used · a weekly review attempting it |
| `classifyEntry` | planned day · off day · a day inside a pause · a flexible-schedule day |
| `reviewWindows` | weekly and monthly cadence · a partial final window · an extension boundary |

## What will NOT be tested — deliberately

The half of D-08 that was never written down. An untested area you chose is a
risk; an untested area you never noticed is a bug waiting.

- **Next.js framework behaviour.** Routing, rendering, the build. Not ours.
- **Third-party libraries.** `pg`, `node-pg-migrate`, the AWS SDK. A test here
  tests the vendor. *(The one exception the journeys make is the `pg` DATE
  round-trip — we test our handling of it, not the driver.)*
- **Getters, constructors and pure pass-through service methods.** A service that
  loads, calls one domain function and saves is covered by the domain test and the
  journey test; a unit test of the middle adds coverage and no information.
- **Generated code and configuration files.**
- **Visual appearance.** No snapshot tests of markup. They fail on every
  legitimate change and get regenerated without reading, which trains you to
  ignore a red build.
- **Terraform plans.** The infrastructure is verified by deploying it and by
  `terraform destroy` recreating it, not by asserting on a plan.
- **The seed script**, beyond it running without error.

## Consequences

**Good**

- The two things that block a merge are the two where a gap means something
  specific: a domain rule with no test, or a journey that no longer completes.
- The domain target cannot be satisfied cheaply — 100% plus a named case list is
  not reachable by covering the easy paths — and the journeys close the wiring gap
  that coverage of any percentage leaves open.
- "What is not tested" is a written list, and the journey table names exactly which
  end-to-end paths are guarded and which are left to the manual walk.

**Costs accepted**

- End-to-end tests are the slowest and flakiest kind. The mitigation is to keep the
  set at four and deterministic — a fixed clock, a seeded database, no reliance on
  wall-clock timing — and to spend the flakiness budget only on journeys that earn
  it. If a journey test goes flaky, it is fixed or removed, never retried-until-green.
- 100% on the domain will occasionally force a test for a branch that cannot
  realistically happen. When that occurs, the right fix is usually to delete the
  branch, not to write the test — if it cannot happen, it should not be reachable.
- Two blocking layers plus advisory coverage is more configuration than one number.
  Worth it.

## Revisit when

- **E-08, with mutation testing.** Mutation testing measures what coverage only
  pretends to: it changes the code and checks whether a test notices. That is the
  honest version of the domain question, and it belongs in the sprint where real
  usage has shown where the bugs actually were.
- **A wiring bug lands in a journey not in the table.** Promote that journey into
  the blocking set, with the defect named as the reason.
- A production defect lands in something on the "will not be tested" list. Then
  that line was wrong and should move, with the defect named as the reason.
