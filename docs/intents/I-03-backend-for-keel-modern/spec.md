# Spec — I-03 · Fit the backend to the Keel Modern design

**Intent:** `intent.md` in this folder · **Status:** Accepted (revision 2) · **Written:** 2026-10-20 · **Accepted:** 2026-10-20, revision 2 on 2026-10-21

*Revision 2* adds G14–G39. Checking every screen against the plan found gaps that
`contract-gaps.md` had not listed. They are in scope because
the intent's test is that no screen has to work around the API.

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

**The plan so far** (G14, G15, G23)

- An objective reports its figures so far, by the same rule as its whole-run figures,
  over the days that have ended plus today. A flexible week counts once it has
  ended, so a week in progress never lowers the score.
- An objective says whether it is on track, at risk or behind, from its adherence so
  far, by one rule every screen reads. Before anything has ended, it says nothing.
- An objective says the date its current status began.

**Weeks** (G16, G17)

- An objective reports its figures for each plan week, by the same rule. The weeks
  are tiled from each plan segment's start.
- A flexible objective counts its weeks, and the weeks that met their target.

**Effort, as it happened** (G18, G21, G29)

- An objective's entries over any date range can be read in one call, with their
  times, along with the last date anything was logged on it.
- Effort is logged only for today, and an entry can be edited or deleted only on
  its own day, in the zone it was logged in. Once a day is over, its effort is
  fixed.
- Every entry has a start time, and no two of a user's entries on one day overlap,
  under any objective.

**Today** (G24–G28)

- A flexible objective on Today reports what it has logged in its current week, and
  how many days of that week were worked.
- Each objective on Today carries its adherence so far, its band and its start date,
  so Today stays one call.
- Today reports the time planned for the day, and how much of it is still to go.
  Only fixed schedules plan time for a particular day.
- Extra effort on off days covers the same week as the week's total.

**Reviews, as the tab shows them** (G19, G20, G22)

- The reviews list carries every due window, including those not started yet, with
  its label and period.
- Each review in the list says the change it set.
- A final review's figures cover the whole plan up to its end. Its deviations and
  its last change stay on its last period.

**Deviations and the parking lot** (G31–G34, G37, G38)

- An idea says the date of its current verdict. Taking an idea is dated the day the
  objective is created.
- Before an idea is parked, the lock it would get can be read.
- A deviation says its place in its pattern's history, and the date of the review
  that will judge it.
- An objective says when its next review falls, even before one is due.

**Kept as they are** (G9, G11, G12)

- The final review offering only *Complete* or *Extend*, onboarding shown to a user
  with no objectives, and a required reason when pausing or terminating need nothing
  new from the backend.
- **Undo** after a verdict needs nothing either: the UI holds the request until its
  toast closes, and Undo cancels it before it is sent. A verdict that reached the
  server is final.
- **A saved review's figures** are recomputed whenever it is read, as before (G21).
  The screen says so, instead of claiming they are frozen.
- **A new account** starts with no patterns (G35). **A new pattern and its
  deviation** stay two calls (G36). **New objective's
  preview** uses the same review-windows rule the server does, imported by the UI
  (G39).

**Reading it all back**

- Notes are scoped to the caller like everything else (NFR-10), and reading an
  objective or the parking lot with its notes does not fan out per row (NFR-03).

## Out of scope

Every screen. Branding Cognito's managed login (G1). The user's name and reading
the signed-in user back (G30), which wait for the sign-in and sign-up screens to be
final (TRIAGE). Field names the UI maps, and the
design's shorter field limits, which the UI enforces inside the contract's larger
ones.
