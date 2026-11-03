# I-15 — Pause, resume, terminate; notes

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-11-03 · **Accepted:** 2026-11-03

## Intent description

Plans meet life. An objective sometimes has to stop for a while, and sometimes stop
for good, and the record should say when and why rather than fill with missed days.
A user also learns things along the way that belong with the objective but are not
effort or a deviation. An objective's Overview shows its status, its history and its
notes, but none of them can be changed from it: pausing, resuming, terminating and
adding a note are possible only through the API. The approved design is in
`docs/design/screens/04-objectives.md`. This intent builds them.

## Proposed outcome

From an objective's Overview, a user pauses it with a reason and resumes it later,
or terminates it with a reason, and each change shows in its status history in the
user's own words. A user adds short notes to an objective at any time, even once it
has ended, and a note is never edited or deleted.

## How we know it worked

On the deployed service, a user pauses an objective: it leaves Today, no day of the
pause is planned or missed, its reviews wait, and its end date stays. They resume it
and it returns to Today. They terminate another, which moves to Terminated, keeps
everything recorded, and cannot be resumed. Notes added to a running and to a
terminated objective show newest first and cannot be changed.

## Out of scope

Notes on parked ideas, which come with the Parking lot. Moving an objective's end
date when it is paused — paused days are not made up, by design.
