# I-14 — Final review: Complete and Extend

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-11-02 · **Accepted:** 2026-11-02

## Intent description

An objective is declared so that, at its end, the record decides what happens next.
The final review is where that decision is made: the whole plan in numbers, the
success criteria judged, and then complete it or extend it. Reviews fall due and
open today, but the last one — the final review — is listed and cannot be opened, so
no objective can finish. The approved design is the Final review in
`docs/design/screens/05-reviews.md`. This intent builds it.

## Proposed outcome

When a plan ends, its final review opens like any other review. It shows the whole
plan, asks whether last time's change worked and whether the last week's chosen
deviations held, has the user judge the success criteria, and ends with a choice:
complete the objective, or extend it with a new end date and the schedule for the
extra time. Either choice is recorded in the objective's history, and a saved final
review reads back with its verdict and outcome.

## How we know it worked

On the deployed service, one objective's final review is saved with Complete: it
moves to Completed and leaves Today. Another is saved with Extend and a changed
schedule: it returns to Today on the new days, its later reviews follow the new plan,
and its history shows the extension. Both saved reviews read back with the criteria
verdict and the outcome.

## Out of scope

Pausing, resuming, terminating and notes. A flexible schedule for an extension (v2).
