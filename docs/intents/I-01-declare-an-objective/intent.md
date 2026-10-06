# I-01 — Declare an objective

**Author:** Rohit · **Status:** Drafted · **Raised:** 2026-10-05

## Intent description

An objective is where a user declares what they are going for: the goal, the
timeline it runs over, and the effort they plan to put in. It is the thing effort is
later logged against, and that logged effort is the evidence — so an objective is
what makes the record able to decide anything.

This intent builds the objectives backend: a user can declare an objective with a
schedule, read back the objectives they have declared, open one of them, and see the
day-by-day schedule it commits them to.

## Proposed outcome

A user can create objectives, see the ones they have created, open any one of them,
and see the day-by-day schedule it commits them to.

## How we know it worked

An objective is created through the API, then:

- the list returns it, with the schedule it was given and a status of active;
- opening it returns its plan and the history of what has happened to it;
- its schedule reads day by day across the whole run, with each day saying whether it
  was planned and whether it was worked.

Both schedule modes work — fixed weekdays and a flexible days-per-week count — and
both review cadences, weekly and monthly.

Logging effort against one planned day and one off day is part of the check: without
effort the schedule cannot show the difference between a day that was met, a day that
fell short, and a planned day with nothing on it.

The reads are the verification, not a second outcome.

## Out of scope

Status changes — pause, resume, complete, end. Review dates. Extensions. Every
screen.
