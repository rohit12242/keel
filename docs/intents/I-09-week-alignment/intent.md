# I-09 — Calendar weeks and months, and v1 plans fixed objectives

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-10-24 · **Accepted:** 2026-10-24

## Intent description

A week in Keel means two things today. Today's "This week" runs Monday to Sunday,
while weekly reviews and an objective's weeks run from the day it started, so every
objective has weeks of its own. Monthly reviews do the same with months. A flexible
objective adds a third reading: its weekly target is counted over its own week, so no
figure on Today can sum it honestly with the rest.

This intent gives Keel one week, Monday to Sunday, and one month, the calendar month,
and keeps v1 to fixed objectives, which plan days. Flexible objectives come back in
v2, built on the same week.

## Proposed outcome

Every week a user sees — weekly reviews, an objective's weeks, Today's week — runs
Monday to Sunday, and every monthly review covers a calendar month. A review falls on
the same day for every objective with the same cadence. New objectives are fixed: Keel
no longer offers or accepts a flexible one.

## How we know it worked

On the deployed service, objectives started on a Thursday and on a Monday both have
their weekly reviews end on Sundays, and their weeks line up with Today's "This week".
A monthly objective started on the 10th has its reviews end on the last day of each
month. New objective offers no flexible schedule, and the API refuses one.

## Out of scope

Flexible objectives on screen, and the rules they will need — v2. Today and its
summary (I-08, revised after this). Choosing which day a week starts on.
