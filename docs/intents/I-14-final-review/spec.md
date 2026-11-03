# Spec — I-14 · Final review: Complete and Extend

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-11-03 · **Accepted:** 2026-11-03

The design this needs is in the repository: the Final review and the saved review in
`docs/design/screens/05-reviews.md`, `plan_segment.plans_from` in `docs/erd.md` and
the I-14 amendment to ADR-008, the
adherence and review-window rules in `docs/domain/`, and G9, G22, G48 and G49 in
`docs/design/contract-gaps.md`. The contract is the review operations and
`POST /v1/objectives/{id}/extensions`. This file does not repeat them.

## What must be true

**Opening it**

- A due final review opens from the Reviews tab and the due-review banner, like any
  review: oldest first, as a draft that can be continued or discarded (I-13).

**The review, as designed**

- The plan in numbers covers the whole plan (G22), with one adherence row per plan
  week; Last change and the Chosen deviations of the last period; Success criteria;
  Reflect; and What next — in the design's five cards, on desktop and phone.
- Success criteria quotes the objective's criteria and the day they were set, and asks
  where the user is and what shows it.
- What next offers **Complete it** or **Extend it**. Extend opens the extension's
  length, its fixed schedule filled in from the current plan, its review cadence, and
  why. Fixed only (I-09). Its preview of dates matches what the extension will plan.
- Every check in the design runs at once, in its words, including the six-month limit.
  The save button names the outcome.

**Complete**

- Saving with Complete records the criteria verdict and completes the objective: it
  moves to Completed, leaves Today, and its history says so. The design's toast shows.

**Extend**

- Saving with Extend saves the review, then makes the extension. The objective returns
  to Today on its new days, its later reviews follow the new plan and cadence, and its
  history records the extension with its schedule.
- An extension made after the plan had ended plans from the day it is made; the days
  between plan nothing and are never counted as missed (G48). Made on time, it plans
  from the day after the old end, as before.
- If the extension fails after the review is saved, nothing is lost: the saved final
  review and the Overview say the extension wasn't made and offer it again until it is
  (G49).

**Saved final review**

- It reads back as designed: Success criteria with its verdict, and What next —
  completed, or extended to a date with the extension's schedule and why.

**What does not change**

- Weekly and monthly reviews, and the windows rule. An extension still needs a saved
  final review that has not extended. No new runtime dependency. Accessibility as
  `01-shell.md` sets it.

## Out of scope

Pausing, resuming, terminating and notes. A flexible extension (v2).
