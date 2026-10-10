# Domain rule — the parking lock

**Intent:** I-02 · **Layer:** `src/**/domain/**` — pure, no I/O.

How long a parked idea stays locked, and what the lock refuses. The contract says
only that "the lock length is set by the server"; this is the rule it sets. It is
read off the Parking lot and New objective designs, where it was drawn but never
written down.

---

## The rule

```
lockedUntil(caughtOn, activeObjectives) -> date

  = the latest current end date among the objectives that were active on caughtOn
  = caughtOn, when none was
```

An idea is caught *while something is running*, and it is locked until **everything
that was running has finished**. The design shows it: two ideas caught on 28 and
31 August both open on 21 September, when the only objective then running ended; an
idea caught on 14 September, with a longer objective also running, opens on
2 November.

- **The latest end, not the earliest.** An idea interrupts all of the work in
  progress, not one objective. Unlocking it when the shortest run ends would hand it
  back while the rest is still going.
- **Current end date** means the end of each objective's latest segment, as it stood
  on `caughtOn`.
- **Nothing running, nothing to protect.** With no active objective there is no work
  to be interrupted, so the idea is unlocked the day it is caught.

## It never moves

`locked_until` is computed **once**, when the idea is parked, and stored (ERD:
*"Set when parked. Never moves."*). Extending an objective afterwards does not extend
the lock, and completing one early does not shorten it. A lock that follows the
schedule can be renegotiated by changing the schedule, which is the behaviour it
exists to stop.

This is the one place a date derived from the plan is stored rather than recomputed,
and it is deliberate: the lock is a commitment made at the moment of parking, not a
figure about the plan.

## What the lock refuses, and what it does not

| While locked | |
|---|---|
| A verdict — `parked` or `dropped` | **Refused** (`422`). Judging an idea before the lock lifts is the one thing the parking lot exists to prevent. |
| Taking it — creating an objective from it | **Allowed.** The design shows an idea *"promoted before its unlock date"* and labels it *early*. Committing to an idea is a decision the lock does not forbid; judging it in a hurry is. |

**Early** is computed, never stored: an idea was taken early when its `taken`
verdict's date is before its `locked_until`.

`locked` on the response is computed against today in the user's zone.
