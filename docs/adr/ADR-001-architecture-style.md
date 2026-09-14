# ADR-001 — Architecture style

**Decision:** D-01 · **Story:** W3-03 · **Status:** Decided (accepted without the spike) · **Date:** 2026-09-15

> **Revision 2.** NFR-12 (timezone and DST correctness) is deferred to v2. The first
> draft of this ADR leaned on it as the lead argument. It has been removed and the
> decision re-argued without it — see *Context* and *Evidence*.

## Context

Keel is one deployable serving one user, with a decided stack: Node + TypeScript
on Next.js (D-02), PostgreSQL (D-03), server-rendered client (D-04), REST behind a
written contract (D-05), AWS (D-06).

The question D-01 framed was:

> Does Keel have enough rules that belong to neither the web nor the database —
> plan-slot generation, adherence, day boundaries, review windows — to justify a
> domain layer that can be tested without either?

The ERD answered it. Keel is not CRUD — but the reason is not date correctness.
**It is that the same rule is needed in more than one place.**

| Rule | Where it is needed |
|---|---|
| `adherence` | Today, objectives list, objective overview, effort tab, review, review detail — **six screens** |
| `generateSlots` | Real generation, and the New objective preview panel (gap G-09) |
| `canExtend` | The API, as 409 and 422 — and the UI, as whether Continue is enabled |
| `classifyEntry` | Today, and the effort tab |

A rule with one call site can live wherever it is convenient. A rule with six call
sites will be written six times, and the six will disagree. **Keel's entire claim
is that the record decides what to do next.** Two screens showing different
adherence for the same week does not make the product slightly wrong — it makes it
worthless, because there is no longer a record to defer to.

That argument does not depend on NFR-12, on dates, or on anything deferred.

## Options considered

| Option | Verdict |
|---|---|
| **Transaction script** — handlers run their own queries, no layers | Rejected. Correct when handlers are thin; Keel's are not. |
| **Layered (n-tier)** | Accepted as the family. |
| **Modular monolith** — one deployable, organised by feature | Accepted as the top-level shape. |
| **Hexagonal / ports and adapters** | Partly adopted. The pure domain, without the interfaces. |
| **Event-driven / CQRS / event sourcing** | Rejected. See below. |
| **Microservices** | Rejected. NFR-10 caps at 100 users, one developer. |

## Decision

**A modular monolith, organised by feature at the top level, with a layered
inside and exactly one hard boundary: the domain is pure.**

```
src/
  app/                     Next.js route handlers. HTTP in, JSON out. No rules.
  modules/
    objectives/
      domain/              pure functions + types. No I/O of any kind.
      repo.ts              the only file with SQL in it
      service.ts           one function per use case
    effort/  reviews/  parking/
  shared/
    time/                  localDayOf, week starts, DST. One implementation.
    result.ts              Ok/Err, so rules return a reason rather than throw
```

**The rule that makes it an architecture rather than a naming convention:**

> Everything may import `domain/`. `domain/` may import nothing — not the route
> handlers, not the repository, not any library that speaks HTTP or SQL, not the
> clock, not a random source.

This is enforced by an import-boundary lint rule in CI (W3-10), not by memory.

## What goes in the domain

| Function | Which written rule it implements |
|---|---|
| `generateSlots(segment)` | Fixed → day rows, flexible → week rows |
| `localDayOf(instant, tz)` | The midnight boundary. v1 needs only the simple case — see the note below |
| `adherence(slots, entries)` | Planned days worked, target met, percentage |
| `reviewWindows(cadence, segment)` | The rule gap G-06 named |
| `canExtend(objective, review, newEnd, today)` | ERD invariants 6 and 7 |
| `classifyEntry(entry, slots)` | Planned or extra — derived, never stored |

Each one is a rule already written down somewhere else. The domain layer is where
the ERD's invariants stop being prose.

### On NFR-12 being deferred

Two halves, and only one of them defers cleanly.

**Defers to v2:** the timezone matrix, DST boundaries, what happens when the user
travels. One user in one zone will not hit these, and building for them now is
work with no reader.

**Does not defer:** the `local_date` column, and the client sending the day it
means. Two reasons. The midnight boundary is real even for one user in one zone —
logging at 00:30 for work done the previous evening happens in week one. And if v1
stores only a UTC timestamp, adding `local_date` in v2 means backfilling a year of
rows by guessing which day each one belonged to. The column costs nothing now and
is the single most expensive thing on this list to retrofit.

So: **keep the schema, drop the test matrix.** That is a scope decision, not a
correctness one, and it belongs in the NFR document rather than buried here.

## Consequences

**Good**

- Adherence has exactly one implementation, so six screens cannot disagree about
  the same week. This is the consequence that protects the product's only claim.
- The rules are testable in milliseconds with no server and no database, so they
  are tested on every commit rather than occasionally.
- The rules have one home. G-09 (the New objective preview duplicating slot
  generation) is solved by calling the same function.
- Feature-shaped folders match feature-shaped sprints.

**Costs accepted**

- More files than a transaction script. Roughly three per module instead of one.
- A service layer that is sometimes a thin pass-through. That is fine; a boundary
  that only earns its keep in complex cases is still worth having in simple ones.
- The boundary rots without the lint rule. If W3-10 does not land it, this ADR is
  aspirational.

## Deliberately not done

- **Repository interfaces.** Full hexagonal would have the domain define
  `ObjectiveRepository` and Postgres implement it. That pays off when the adapter
  is swapped. Postgres will not be swapped. Add it the day there is a second
  implementation, not before.
- **Event sourcing.** Keel is already append-only where it matters — status
  events, plan segments and parked-idea verdicts are history, not mutable state.
  That is the useful half of the idea applied where it earns its cost. Replaying
  events to derive current state for 1,680 rows a year is not.
- **A separate API project.** Next.js route handlers are the API. D-02 bundled
  this deliberately.
- **A dependency injection framework.** Four modules and one database. Pass
  arguments.

## Evidence

The twenty-minute test, rewritten now that NFR-12 is deferred. Use **adherence**
instead — it is the rule with six call sites, so it is the one that matters most.

Write `adherence(slots, entries)` as a test first: a handful of plan slots, a
handful of effort entries, an expected percentage. Then ask:

- Did writing it need a running database, or a web request? → the domain layer is
  missing, and this ADR is right.
- Did it write naturally as a function over two plain arrays? → the layer already
  exists in your head; this ADR is only giving it a folder.

Then the second half, which is the real check: **write the same test for a flexible
schedule** — where the target is a week and the count is days-worked-of-five.
If that needs a different function rather than different inputs, the plan-slot
unification in the ERD is wrong, and it is far cheaper to learn that today than in
Sprint 02.

**Result: not run.** The decision was accepted on the argument rather than the
evidence — six call sites for `adherence`, and the cost of them disagreeing.

That is a legitimate way to decide and a worse way than running the test, so it is
recorded as what it is. The evidence arrives anyway at the first real
implementation in Sprint 02: if `adherence` turns out to need a database, or if the
flexible-schedule case needs a different function rather than different inputs,
this ADR was wrong and should be revised then rather than defended.

## Revisit when

- A second deployable is genuinely needed — a scheduled job that cannot live in
  the web process.
- The service layer is pure pass-through in every module after Sprint 05. Then the
  layer is ceremony and should be collapsed.
- A second storage implementation appears. Then the repository interfaces earn
  their place.
- **NFR-12 comes back in v2.** Nothing about this ADR changes — the timezone rules
  land in `shared/time` with their tests, which is the folder they were always
  going to live in. Deferring the requirement does not defer the structure.
