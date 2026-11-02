# Spec — I-13 · Reviews: weekly and monthly

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-11-02 · **Accepted:** 2026-11-02

The design this needs is in the repository: Rules, the Reviews tab, the weekly or
monthly review and the saved review in `docs/design/screens/05-reviews.md`, the
windows in `docs/domain/review-windows.md`, and G6, G7, G10, G19–G21 and G47 in
`docs/design/contract-gaps.md`. The contract is the review operations and
`GET /v1/objectives/{id}/schedule`. This file does not repeat them.

## What must be true

**Finding a review**

- An objective gains the Reviews tab beside Overview, Effort and Deviations, its
  label carrying the saved count. Due and Saved read as designed,
  including the many-reviews grouping and the phone layout.
- Overview gains the due-review banner, as designed, opening the oldest due review.
- Only the oldest due review opens; the rest wait with "Opens after …". A paused
  objective's reviews wait. Which reviews are due, and their labels and periods, come
  from the API (G19), never from a rule on the page.

**Writing one**

- The weekly or monthly review reads and behaves as designed, in its four cards.
- The tiles come from the review's figures; their hints from the previous **saved**
  review of the objective, named in the card's hint, or none.
- Day bars come from the schedule grid over the period — the same days, states and
  targets as the Effort tab. A monthly review shows one row per Monday-to-Sunday week,
  clipped to the month, summed from the same days.
- "Did last week's change work?" quotes the previous saved review's change, with all
  four answers (G6). The first review shows "Nothing to check".
- Only Chosen deviations are judged, each It held or It didn't hold. Drifted ones are
  counted in the hint, not judged.
- Reflect has the three fields, with the design's limits (G7).

**Drafts**

- The draft is saved as the user goes and by **Save draft**, with the time it was
  last saved (G10). Leaving and coming back continues it exactly, verdicts included.
- **Discard draft** asks first, then deletes the draft and the verdicts it gave; the
  review is owed again and the toast says so. This closes the TRIAGE entry "No screen
  discards a review draft".
- A draft's verdicts show only in the draft. On the Deviations page and Today a verdict
  shows once its review is saved (G47).

**Saving**

- **Save review** checks everything at once, in the design's words, and scrolls to the
  first problem. It sends once, whatever the clicks; if it fails, nothing is lost and
  the page says so.
- After saving: the Reviews tab with the design's toast, saying when another is due.
- A saved review reads back as designed, with "Recomputed from the record" (G21), the
  lock note, and previous and next. Nothing edits or deletes it.
- The next review quotes this one's change.

**What does not change**

- The windows, the figures and the review rules, apart from G47. No new runtime
  dependency. Accessibility as `01-shell.md` sets it.

## Out of scope

The final review, Complete and Extend: a final review shows on the Reviews tab as
due, and opens in its own intent. Pausing, resuming, terminating and notes. Flexible
objectives (v2).
