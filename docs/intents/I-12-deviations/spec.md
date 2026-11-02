# Spec — I-12 · Deviations, and Log a deviation

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-10-31 · **Accepted:** 2026-10-31

The design this needs is in the repository: `docs/design/screens/06-deviations.md`,
the Deviations tab in `04-objectives.md`, Today's rail in `03-today.md`, the shared
patterns in `01-shell.md`, and G32–G36 and G46 in `docs/design/contract-gaps.md`. The
contract is `GET`/`POST /v1/deviations` and `GET`/`POST /v1/deviation-patterns`. This
file does not repeat them.

## What must be true

**Log a deviation**

- It opens from the Deviations header and its empty state, from Today's rail, and with
  `D` on Today and Deviations. The dialog behaves and reads as designed.
- **When** offers this week's days, Monday to Sunday, in the user's zone, today by
  default and later days disabled. **Pulled you away from** offers one chip per
  objective that could take time on the day picked, and follows the day as it
  changes; one is picked (G46).
- A drifted deviation names a pattern, **None of these**, or a new one. A new account
  has no patterns (G35). A new pattern is created when the deviation is recorded; if
  the deviation then fails, the pattern stays and is picked on retry (G36).
- Every check in the design runs in the dialog, in its words, before anything is sent,
  including the design's shorter limits and an existing pattern's name.
- Recording sends once, whatever the clicks. If it fails, the dialog keeps what was
  typed and says nothing was recorded.
- After recording: the Deviations page, the new one selected, its row flashing once,
  and the design's toast.

**The Deviations page**

- This week only, Monday to Sunday: the filter with counts, the week box, list and
  detail, the rows and the detail as designed, on desktop and phone.
- The week box's figures are the API's cost totals. "3rd time" is the deviation's own
  place in its pattern (G32), and "At the 21 Sep review" its own review date (G33);
  neither is worked out on the page. A verdict, once a review has given one, shows in
  place of "Not reviewed yet".
- Nothing on the page edits or deletes a deviation.

**On Today and on an objective**

- Today's rail shows **Log a deviation** and the last deviation card, as designed, with
  **Open in Deviations** when it is from this week.
- An objective gets its Deviations tab — the summary line, Most recent, By week over
  its plan weeks, and the week dialog — and So far gains Deviation time with its count.
  The tab's label carries the count.
- The page adds deviations' minutes and counts them by kind or by plan week; it applies
  no other rule. Every place shows the same totals for the same deviations.
- A deviation that names several objectives (recorded through the API) shows on each,
  and its "Pulled from" lists them all.

**What does not change**

- The API and the contract. No new runtime dependency.
- Accessibility as `01-shell.md` sets it.

## Out of scope

Judging a deviation at review. Deviations before this week on the Deviations page. The
Parking lot and `P`. Editing or deleting a deviation, by design.
