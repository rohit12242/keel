# Spec — I-06 · New objective

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-10-23 · **Accepted:** 2026-10-23

The design this needs is in the repository: the New objective page in
`docs/design/screens/04-objectives.md`, the frame and its patterns in `01-shell.md`,
and G39–G42 in `docs/design/contract-gaps.md`. The contract is `POST /v1/objectives`.
This file does not repeat them.

## What must be true

**Getting there and back**

- The Objectives page's header carries **+ New objective** (**+ New** on phone), and
  it opens the New objective page. The rest of the Objectives page stays as it is.
- **‹ Objectives** and **Cancel** go back to Objectives, and nothing is created.

**The page, as designed**

- What it is, Schedule and Plan behave and read as designed, on desktop and phone. The
  sticky footer stays in view.
- The Start options are today, tomorrow and next Monday in the browser's own calendar.
  The objective is sent with that date and the browser's zone, never the server's
  clock (NFR-12).
- The preview — the end date, the review line and the three tiles — always matches what
  Create would store. It comes from the same rules the server uses (review windows,
  planned days), not a second copy of them.
- A flexible weekly target is shown as the week it really makes, after rounding (G40).

**Mistakes are caught before anything is sent**

- Every check in the design's list runs on the page, in its words, including the
  15-minute minimum (G41). A form that passes them is one the API accepts.
- Errors show as `01-shell.md` sets out: under the field, the field marked, focus on
  the first one. An error clears as soon as its field is edited.
- The design's shorter text limits hold on the page; the contract keeps its own.

**Creating it**

- Create sends one request, whatever the clicks. While it is in flight the page says
  so and cannot send again.
- On success the user lands on Today with the design's toast: "Objective created. It
  starts today." or "… starts Sun 6 Sep." An objective that starts today is on Today.
- If it fails, everything entered stays, and the page says it did not work and that
  nothing was created. A session that has ended goes to Sign in.
- A 12-month plan is accepted even across a 29 February (G42).

**The toast**

- There is one toast, as `01-shell.md` sets it out: placement, timing, above the tab bar
  on phone. The sign-in screens use the same one; their own copy is gone.

**What does not change**

- The API, apart from G42. The session. No new runtime dependency.
- Accessibility as `01-shell.md` sets it.

## Out of scope

Starting from an approved idea and the "Start from" card. The Objectives list and
detail, so a new objective does not yet open selected under Active. Today's redesign
and its empty card. Dialogs and keyboard shortcuts. Onboarding.
