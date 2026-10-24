# Spec — I-09 · Calendar weeks and months, and v1 plans fixed objectives

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-10-24 · **Accepted:** 2026-10-24

The design this needs is in the repository, changed in this branch:
`docs/domain/review-windows.md` (the rule, its examples and its decisions),
`docs/domain/adherence.md` (*Plan weeks*, *Over a window*), `docs/keel-api.yaml`
(`Objective.weeks`, the flexible refusal) and `docs/design/README.md` with the screen
examples. This file does not repeat them.

## What must be true

**One week and one month**

- Every weekly review window and every plan week is a Monday-to-Sunday week; every
  monthly review window is a calendar month, each clipped to its plan segment.
- A first or last period that is short — under 4 days for a week, under 15 for a
  month — joins its neighbour. The same holds for each segment of an extended plan.
- The last window of a segment is still its plan-end review, and labels still run on
  across an extension.
- A plan week and a weekly review window are the same days, so "Week 2" means one
  thing on the Effort tab and in the reviews. Today's "This week" is the same
  Monday-to-Sunday week.
- Everything that reads review windows follows them without a rule of its own: which
  review is due and how many, the next review (due or not), the review a deviation
  falls in, a plan-end review's span, and New objective's preview.
- Pauses still move no boundary, and a window with no planned day is still never due.
- Windows are the same in every zone (NFR-12), and stay computed, never stored.

**v1 plans fixed objectives**

- New objective offers only a fixed schedule: no choice cards, no flexible fields.
- The API refuses a flexible schedule when creating an objective or extending one,
  with `422`. None is stored (Rohit, 2026-10-24), so no flexible objective exists to
  read.
- The backend that reads flexible plans stays as it is, with its tests, for v2.

**Data already stored**

- Nothing is migrated: windows and weeks are computed, so stored objectives read on
  the new rule at once. A review saved before this change keeps its own dates, so its
  period may show as due again. Every stored account is a test user's (Rohit,
  2026-10-24), so this is accepted.

**What does not change**

- Fixed day slots, adherence and the figures rule. Plan length in New objective: *n*
  months still ends the day before the same date *n* months on. The session. No new
  runtime dependency.

## Out of scope

Flexible objectives on screen, and their weeks — v2 (`docs/intents/TRIAGE.md`).
Today (I-08). Choosing the day a week starts on.
