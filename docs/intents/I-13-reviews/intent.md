# I-13 — Reviews: weekly and monthly

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-11-02 · **Accepted:** 2026-11-02

## Intent description

Keel keeps the record so that a review can run on evidence instead of memory. Reviews
fall due on every objective — each Sunday for a weekly one, each month's end for a
monthly one — but nothing a user sees can open one: a review can be written today only
through the API. The approved design is `docs/design/screens/05-reviews.md`, with the
Reviews tab and the due-review banner on an objective. This intent builds the weekly
and monthly review.

## Proposed outcome

When a review is due, the objective says so and opens it, oldest first. The review
shows the period's figures and day by day, asks whether last time's change worked,
has the user judge whether each chosen deviation's reasoning held, and ends with one
change to try next. A review can be left as a draft and continued, and once saved it
reads back as it was answered and is never edited. Each objective lists its reviews,
owed and saved.

## How we know it worked

On the deployed service, a user with a weekly and a monthly objective sees each review
fall due on the right day, starts one, leaves it as a draft, continues it and saves it.
The saved review reads back unchanged, its chosen deviations show their verdicts on
the Deviations page, and the next review quotes its change. With two reviews owed,
only the oldest opens.

## Out of scope

The final review — Complete and Extend — which is its own intent. Pausing, resuming,
terminating and notes. Flexible objectives (v2).
