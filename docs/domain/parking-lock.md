# Domain rule — the parking lock

**Intent:** I-02, revised in I-03 and I-16 · **Layer:** `src/**/domain/**` — pure, no I/O.

How long a parked idea stays locked, and what being locked means. The contract says
only that "the lock length is set by the server"; this is the rule it sets. It is
read off the Parking lot and New objective designs, where it was drawn but never
written down.

---

## The rule

```
lockedUntil(caughtOn, activeObjectives) -> date

  = the earliest current end date, on or after caughtOn, among the objectives
    that were active on caughtOn
  = caughtOn, when there is none
```

An idea is caught *while something is running*, and it is locked until **the first
of those runs has finished**. Two ideas caught on 28 and 31 August both open on
21 September, when the only objective then running ended. An idea caught on
14 September, with System design ending 21 September and a longer objective ending
2 November, opens on 21 September.

- **The earliest end, not the latest** *(Rohit, 2026-11-04, I-16)*. The first
  objective to end is the first natural point to decide. Waiting for the longest
  run, as I-02 to I-15 did, held an idea for months behind a plan that had nothing
  to do with it. *(Until I-16 the rule took the latest end.)*
- **Current end date** means the end of each objective's latest segment, as it stood
  on `caughtOn`.
- **An end already past is skipped.** An objective still active after its end date
  (its final review not yet saved) has no run left to finish, so it sets no lock.
  Without this, one overdue final review would open every new idea the day it is
  caught.
- **Nothing running, nothing to protect.** With no active objective there is no work
  to be interrupted, so the idea is unlocked the day it is caught.

**Before it is parked.** The *Park an idea* dialog shows the lock before anything is
saved. `GET /parked-ideas?caught_on=` returns it as `new_idea_locked_until`, from this
same rule, so the dialog and the stored lock cannot disagree. *(I-03.)*

## It never moves

`locked_until` is computed **once**, when the idea is parked, and stored (ERD:
*"Set when parked. Never moves."*). Extending an objective afterwards does not extend
the lock, and completing one early does not shorten it. A lock that follows the
schedule can be renegotiated by changing the schedule, which is the behaviour it
exists to stop.

So the I-16 change applies to ideas parked from then on. An idea parked earlier
keeps the lock it was given, by the latest end; nothing is recomputed or migrated.

This is the one place a date derived from the plan is stored rather than recomputed,
and it is deliberate: the lock is a commitment made at the moment of parking, not a
figure about the plan.

## The lock records; it does not refuse

**No decision is refused because an idea is locked.** Approving, dropping or taking
an idea while it is locked is allowed, and recorded as **early**. The approved design says
it plainly: *"Taking it or dropping it before then is recorded as early, not
blocked."* *(Revised in I-03. Until then a verdict was refused with `422` while the
idea was locked, and only taking it was allowed.)*

The lock's job is to make a hurried decision **visible**, not to prevent it. A dropped
idea that reads *Dropped · early* says something about you that a refused request
never would.

**Early** is computed, never stored: a decision is early when its verdict's
`occurred_on` is before the idea's `locked_until`. The response carries it for the
idea's current verdict (`decided_early`) — approved, dropped or taken; a parked idea
is never early. The response also carries that verdict's date (`verdict_on`).

**A take is dated the day it happens:** the `taken` row's `occurred_on` is the day the
objective is created, in the zone it is created in — not the objective's start date,
which may be later. So an idea taken on 31 August for a plan starting 1 September
reads *Taken 31 Aug*, and is early if 31 August is before `locked_until`. *(I-03.)*

## Dropped and taken are final

Once an idea is dropped or taken, its verdict never changes again (ERD,
invariant 13). Dropping always says why — the verdict's `note` is required — because
the pair *why it grabbed you* and *why it ended* is what the parking lot is for.

`locked` on the response is computed against today in the user's zone.
