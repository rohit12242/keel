# I-08 — Today, with Log time

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-10-23 · **Accepted:** 2026-10-23

## Intent description

Today is where effort gets recorded, and recorded effort is the evidence Keel decides
with. The page shows the day's objectives and entries in the old layout, and nothing
on it can log time: an entry can be written only through the API. The approved design
for Today and its Log time dialog is `docs/design/screens/03-today.md`. This intent
builds them, so that logging the day's effort is something a user does in Keel.

## Proposed outcome

Today reads as designed: how much of the day's plan is logged, each objective's card
with its entries, the objectives not planned today, and how each one is doing so far.
From Today a user logs time, corrects an entry and deletes one, and can undo each of
those straight away. A new account sees one card that sends it to New objective.

## How we know it worked

On the deployed service, a signed-in user logs time against a planned objective and an
unplanned one, edits one entry and deletes another, undoing each once. Today's figures
change to match every time, on desktop and on phone. An account with no objectives
sees the empty card and reaches New objective from it.

## Out of scope

Log a deviation, Park an idea and the last-deviation card on the rail — each arrives
with its own screen. Onboarding.
