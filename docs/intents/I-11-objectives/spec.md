# Spec — I-11 · Objectives, list and detail

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-10-30 · **Accepted:** 2026-10-30

The design this needs is in the repository: List, Detail, Overview and the Effort tab
in `docs/design/screens/04-objectives.md`, list and detail and pills in
`01-shell.md`, and the weeks rule in `docs/domain/review-windows.md`. The contract is
`GET /v1/objectives`, `GET /v1/objectives/{id}`, its `schedule` and its
`effort-entries`. This file does not repeat them.

## What must be true

**The list**

- Filters, counts, rows, the status pill for every state in the design's table, the
  "n reviews due" pill, and the empty states read as designed. Paused, Completed and
  Terminated show even while empty.
- Active is the default filter. Within a filter, the latest start comes first.
- Every figure comes from the API as it is; the page does no plan or adherence rule of
  its own. A row's percentage and band agree with Today's Plan to date.

**The detail**

- Each objective has its own address, so a link opens it and the browser's back
  button works. On desktop the list stays beside it, with the open one selected; with
  none chosen, the filter's first objective is open. On phone the detail is full
  screen with **‹ Objectives**.
- The head, meta line and pill read as designed. The tabs are Overview and Effort,
  and arrow keys move between them.

**Overview**

- In the design's order: the state banner, So far (or The whole plan once ended), Why
  it matters, Success criteria, Notes, Status history and the footer.
- So far shows the ring, Logged effort with "+ over" when any, Targets met and Extra,
  off days, from the figures to date; once the plan has ended, from the whole run.
  Before the first day has passed, it shows the design's line instead.
- What is recorded shows, but no action that belongs to a later intent: the state
  banners without Resume or Open final review, Notes without **+ Add a note**, and the
  footer's words without Pause or Terminate.

**Effort**

- The last day logged and its entries, then By week: one row per plan week, Monday to
  Sunday, a joined first or last week included, labelled Week 1 onwards, the current
  one "so far".
- A week opens the week dialog with its day chips and one block per day, each with
  its tag and entries. Future days are not listed.
- A day's tag and figures come from the schedule grid, its entries from the
  objective's entries over that range — never worked out on the page.

**After creating one**

- Creating an objective from New objective opens it selected under Active, its row
  flashing once, with the design's toast. Onboarding still ends on its own step 3.

**What does not change**

- The API and the contract. No new runtime dependency.
- Accessibility as `01-shell.md` sets it, including the tabs' roles.

## Out of scope

The Deviations tab, and the Deviation time tile in So far — both come with the
Deviations intent. The Reviews tab and the due-review banner — with Reviews. Pause,
resume, terminate, the final review and adding notes. Flexible objectives (v2).
