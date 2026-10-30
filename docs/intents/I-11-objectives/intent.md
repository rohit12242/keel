# I-11 — Objectives, list and detail

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-10-30 · **Accepted:** 2026-10-30

## Intent description

An objective can be created and logged against, but nowhere shows one as a whole: how
far it has run, how it is doing so far, what it was for, and its effort week by week.
The Objectives page says it is not built yet, and a new objective lands on Today
instead of opening where the design puts it. The approved design is the list and the
detail in `docs/design/screens/04-objectives.md`. This intent builds them, with the
Overview and Effort tabs.

## Proposed outcome

The Objectives page lists a user's objectives by status, each with how far it has run
and how it is doing. Opening one shows its Overview — progress so far, why it matters,
what would prove it worked, its status history — and its Effort, the last day logged
and every week of the plan, each week opening to its days. A new objective opens
selected in the list.

## How we know it worked

On the deployed service, a user with objectives in different states — running,
starting later, started today, plan ended — finds each under its filter with the
design's line and pill, opens it, and reads figures that agree with Today's. The
Effort tab's weeks run Monday to Sunday and open to their days. Creating an objective
opens it selected under Active. Desktop and phone both work.

## Out of scope

The Deviations and Reviews tabs, and the due-review banner's action — each comes with
its own screen. Pausing, resuming, terminating, and adding notes: the Overview shows
what is recorded, the actions come later. Flexible objectives (v2).
