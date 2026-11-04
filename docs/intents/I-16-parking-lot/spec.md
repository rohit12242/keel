# Spec — I-16 · Parking lot

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-11-04 · **Accepted:** 2026-11-04 · **Amended:** 2026-11-04, the lock

The design this needs is in the repository: `docs/design/screens/07-parking-lot.md`,
the "Start from" card in `04-objectives.md`, Today's rail in `03-today.md`, the shared
patterns in `01-shell.md`, the lock in `docs/domain/parking-lock.md`, and G3, G4, G13,
G31, G37 and G38 in `docs/design/contract-gaps.md`. The contract is the
`/v1/parked-ideas` operations and `POST /v1/objectives` with `from_parked_idea_id`.
This file does not repeat them.

## What must be true

**Park an idea**

- It opens from the Parking lot header and its empty state, from Today's rail, and
  with `P` on Today and the Parking lot. The dialog reads and behaves as designed.
- Its lock note gives the date the idea would open if parked now, from the API (G38),
  or says it opens straight away when nothing is running. Never worked out on the page.
- Every check runs in the dialog, in the design's words and limits. Parking sends
  once; if it fails, what was typed stays and nothing was parked.
- After parking: the Parking lot, the new idea selected and flashing, and the toast.

**The Parking lot**

- Every idea, newest caught first, in list and detail, on desktop and phone. Each
  state's pill reads as designed, with its date (G31) and "early" when decided before
  the lock lifted. The ⓘ on a locked pill shows the rule.
- The detail reads as designed for each state, a Taken idea with the dates of the
  objective it became.
- `D` works here too, as `01-shell.md` sets it.

**Deciding**

- **Your verdict** offers Still parked, Approved and Dropped on a parked or approved
  idea; a taken or dropped one says the verdict is final.
- Drop asks first, with its reason required, as designed.
- Each verdict is held until its toast closes; **Undo** cancels it before it is sent.
  Leaving or closing the page sends a held verdict at once (G13). The idea shows its
  new state straight away.
- A decision before the lock lifts is recorded, not refused, and reads as early.

**Notes**

- **+ Add a note** on an idea in every state, Dropped and Taken included, as on an
  objective: 120 characters, newest first, never edited or deleted.

**Starting an objective from an idea**

- New objective's "Start from" card offers Scratch or An approved idea, as designed,
  with search when there is more than one. Picking one fills Name and Why only when
  they are empty or still hold the previous pick.
- Creating the objective takes the idea: it reads Taken, dated the day it was taken
  (G37), with the objective's dates. Onboarding keeps no "Start from" card.

**The lock** *(amended 2026-11-04)*

- A new idea is locked until the earliest end date, on or after the day it is caught,
  among the objectives running that day, as `parking-lock.md` now says. With none, it
  opens straight away. `new_idea_locked_until` follows the same rule.
- An idea parked before the change keeps its stored lock.
- The lock note, the ⓘ and the empty state say "earliest".

**What does not change**

- The API and the contract. No new runtime dependency. Accessibility as
  `01-shell.md` sets it.

## Out of scope

Reviving a dropped or taken idea. Parked ideas inside reviews (the
TRIAGE entry "A review still returns parked ideas the design no longer shows").
