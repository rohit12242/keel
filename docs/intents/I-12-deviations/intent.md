# I-12 — Deviations, and Log a deviation

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-10-31 · **Accepted:** 2026-10-31

## Intent description

Effort is half the record. The other half is where time went instead, and why: a
choice made with a reason, or a drift noticed afterwards. Without it, a review sees
a short day but not what took its place, and a pattern that repeats every week stays
invisible. A deviation can be recorded today only through the API. The approved design
is `docs/design/screens/06-deviations.md`, with its parts on Today and on an
objective. This intent builds it.

## Proposed outcome

From Today or the Deviations page, a user records a deviation: Chosen with its
reasoning, or Drifted with the pattern it fits, against the objective it pulled them
from, for a day this week. The Deviations page shows this week's deviations and what
they cost. Today shows the latest one, and each objective shows its own deviations
week by week and the time they took from it.

## How we know it worked

On the deployed service, a user records a Chosen and a Drifted deviation, one naming a
new pattern, from Today and from the Deviations page. Each appears on the page under
its week and kind, on Today as the latest, and on its objective's Deviations tab and
So far, with figures that agree everywhere. A recorded deviation cannot be changed.

## Out of scope

Judging a deviation — whether the reasoning held, or the pattern counted — which is
the review's job. Deviations before this week on the Deviations page; they live on
each objective. Editing or deleting a deviation, by design.
