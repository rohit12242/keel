# Spec — I-15 · Pause, resume, terminate; notes

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-11-03 · **Accepted:** 2026-11-03

The design this needs is in the repository: the Overview's banners, Notes, Status
history and footer, and *Pause, resume, terminate* in
`docs/design/screens/04-objectives.md`, the notes pattern and dialogs in `01-shell.md`,
and G2 and G12 in `docs/design/contract-gaps.md`. The contract is
`POST /v1/objectives/{id}/status-changes` and `GET`/`POST /v1/objectives/{id}/notes`.
This file does not repeat them.

## What must be true

**Pause**

- **Pause** is in the Overview footer while the objective is running or has not
  started, never once its plan has ended. Its dialog reads as designed and requires
  the reason, in the design's words.
- A pause starts on the day it is made, in the user's zone. When time is already
  logged on that objective today, the dialog says that today stops being planned and
  the time stays, as extra.
- Once paused: the objective leaves Today, the list shows it under Paused, its reviews
  wait and its due banner hides, and the Paused banner shows the day and the reason.
  The end date does not move. The design's toast shows.

**Resume**

- **Resume** on the Paused banner, with no dialog. The objective is active again and
  back on Today, its paused days neither planned nor missed, and its history says so.
- Resumed after the plan's end date, the final review is due at once, and the toast
  says so.

**Terminate**

- **Terminate** is in the footer of a running, not-started, paused or plan-ended
  objective. Its dialog reads as designed and requires the reason.
- Once terminated: Terminated in the list, off Today, the Terminated banner, and the
  final footer. Everything recorded stays, and nothing resumes it.

**Notes**

- **+ Add a note** opens the inline box as designed — 120 characters, Enter saves,
  Esc cancels — on an objective in any status, Completed and Terminated included.
- A note is dated today in the user's zone and shows newest first. Nothing edits or
  deletes one.

**For all of them**

- Each change sends once, whatever the clicks. If it fails, the dialog or the box
  keeps what was typed and says nothing was changed.
- Status history shows every pause, resume and termination with its reason, word for
  word, as soon as it is made. Figures, Today and the list agree after each change
  without a full reload.

**What does not change**

- The API and the contract. The status rules: a pause never moves the end date, and
  only the final review completes an objective. No new runtime dependency.
  Accessibility as `01-shell.md` sets it.

## Out of scope

Notes on parked ideas (the Parking lot). Completing an objective outside its final
review.
