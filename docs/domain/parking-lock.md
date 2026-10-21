# Domain rule — the parking lock

**Intent:** I-02, revised in I-03 · **Layer:** `src/**/domain/**` — pure, no I/O.

How long a parked idea stays locked, and what being locked means. The contract says
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

**Before it is parked.** The *Park an idea* dialog shows the lock before anything is
saved. `GET /parked-ideas?caught_on=` returns it as `new_idea_locked_until`, from this
same rule, so the dialog and the stored lock cannot disagree. *(I-03.)*

## It never moves

`locked_until` is computed **once**, when the idea is parked, and stored (ERD:
*"Set when parked. Never moves."*). Extending an objective afterwards does not extend
the lock, and completing one early does not shorten it. A lock that follows the
schedule can be renegotiated by changing the schedule, which is the behaviour it
exists to stop.

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
