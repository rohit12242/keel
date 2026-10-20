# Spec — I-03 · Fit the backend to the Keel Modern design

**Intent:** `intent.md` in this folder · **Status:** Drafted · **Written:** 2026-10-20

What the screens in `docs/design/` need from the backend, gap by gap
(`docs/design/contract-gaps.md`). The design is in the repository; the contract, the
ERD and the domain rules change to match it in the same branch, and this file points
at them rather than repeating them.

## What must be true

**Notes** (G2, G3)

- An objective and a parked idea each carry a list of notes: dated, short, added at
  any time — including after the objective or the idea has reached a final state.
- A note is never edited and never deleted.

**The parking lot** (G4)

- An idea moves from Parked to Approved, and back to Parked if you change your mind,
  or to Dropped.
- Only an approved idea can be started as an objective, and starting one is what makes
  it Taken.
- Taken and Dropped are final. Neither changes again; both still take notes. Dropping
  always says why.
- The lock no longer refuses a decision. Approving, dropping or taking an idea before
  it opens is allowed, and recorded as early.

**Deviations** (G5)

- A drifted deviation needs no reasoning. A chosen one still must have one.

**Reviews** (G6, G7, G10)

- "Did last week's change work?" has a fourth answer, *didn't try it*, which the record
  keeps apart from *didn't work*.
- A review records three reflections — what worked, what got in the way, and what
  changes next — and the third is the one the next review quotes back.
- A draft says when it was last saved.

**Figures** (G8)

- Minutes logged above a day's target are reported as over plan, by the same rule
  every screen uses for every other figure. Adherence stays capped at the target.

**Kept as they are** (G9, G11, G12)

- The final review offering only *Complete* or *Extend*, onboarding shown to a user
  with no objectives, and a required reason when pausing or terminating need nothing
  new from the backend.

**Reading it all back**

- Notes are scoped to the caller like everything else (NFR-10), and reading an
  objective or the parking lot with its notes does not fan out per row (NFR-03).

## Out of scope

Every screen. Branding Cognito's managed login (G1). Field names the UI maps, and the
design's shorter field limits, which the UI enforces inside the contract's larger
ones.
