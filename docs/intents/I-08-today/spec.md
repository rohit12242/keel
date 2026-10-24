# Spec — I-08 · Today, with Log time

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-10-23 · **Revised and accepted:** 2026-10-24

The design this needs is in the repository: `docs/design/screens/03-today.md`, the
frame and its patterns in `01-shell.md`, and G43–G45 in
`docs/design/contract-gaps.md`. The contract is `GET /v1/day/{date}` and the effort
entry operations. This file does not repeat them.

## What must be true

**Today reads as designed**

- The header, summary, filter, cards and the rail's Plan to date card behave and read
  as designed, on desktop, between 861 and 1180 px, and on phone.
- Every figure on the page comes from one read of the day. The page applies no plan or
  adherence rule of its own: beyond formatting, it only counts from what the day
  returns, as the ring and the dialog's hint need.
- The ring shows today's fixed plan only, by the rule in `03-today.md`: logging on an
  unplanned objective, or over one objective's plan, never fills it.
- The day is the user's own day, as the server knows it (I-07).
- A day off, a planned objective, one not planned today, one that starts later, one
  that started today and one whose plan has ended before its final review (G45) each
  read as the design says. v1 objectives are fixed (I-09), so
  Today has no flexible card.
- An account with no objectives sees only the empty card, and **+ Add objective** opens
  New objective.

**Logging, correcting and deleting**

- **+ Log time**, **+ Add entry**, **Log anyway** and `L` open Log time; an entry's row
  opens Edit entry. The dialog behaves and reads as designed, including the times it
  accepts, **Now**, the hint line and the button's label.
- Logging is offered only where the objective's plan covers today (G44).
- Every check in the design runs in the dialog, in its words, before anything is sent.
  An overlap with an entry already on the page is caught there; one the server finds,
  from another tab, shows the same error.
- Saving sends one request, whatever the clicks. While it is in flight the dialog says
  so and cannot send again.
- After each save, Today shows the changed day, figures included, without a full page
  reload.
- If a save fails, the dialog stays open with what was typed and says it did not work.
  A session that has ended goes to Sign in.
- If the day has turned while the page was open, nothing is logged to the old day: the
  dialog says so and Today moves to the new day.

**Undo**

- Each save is sent at once. The toast's **Undo** sends the reverse: a logged entry is
  deleted, an edit is put back, a deleted entry is logged again as it was.
- Undo works while the toast is showing. If it cannot be done, the toast says so and
  the record stays as it is.

**The shared patterns this brings**

- The dialog, the keyboard shortcuts and the toast's Undo are built once, as
  `01-shell.md` sets them out, for the screens after this one to reuse.
- `L` works only on Today, and not while typing or while a dialog is open.

**What does not change**

- The API and the contract, apart from `end_date` on each of the day's objectives
  (G45). No new runtime dependency.
- Accessibility as `01-shell.md` sets it, including focus moving into the dialog and
  back to the button that opened it.

## Out of scope

Log a deviation, Park an idea and the last-deviation card. The `D` and `P` shortcuts.
Onboarding.
