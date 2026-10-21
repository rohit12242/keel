# Domain rule — `figures` (adherence)

**Intent:** I-01 · **Implements:** `src/modules/effort/domain/adherence.ts` ·
**Layer:** `src/**/domain/**` — pure, no I/O.

The one rule that turns a plan and the effort logged against it into the figures
every screen shows: adherence, logged against target, planned days worked, target-met
days, and extra effort on off days. ADR-001 counts **six screens** that show
adherence. They all call this function, so they cannot disagree.

---

## What it is not

- **Not stored.** Nothing here is written down: not a percentage, not a total, not a
  count (NFR-09, invariant 15). Every figure is recomputed from the facts on every
  read. ADR-008 accepted the consequence: a corrected rule changes what the past was.
- **Not the plan.** It does not decide which days were planned. That is
  `planSlots(segments, statusEvents)`, which applies the schedule and the status
  timeline (pause suppression lives there and nowhere else). This rule takes those
  slots as given.
- **Not windowed.** It computes over whatever slots and days it is handed. The whole
  run for an objective, one window for a review (`docs/domain/review-windows.md`), a
  plan week, the plan so far: the caller chooses the span, and the rule does not
  change (*Over a window*, below).
- **Not the day states.** What the schedule grid shows for one day is
  `docs/domain/day-states.md`. The two agree because both read the same slots.

---

## Signature

```
figures(slots: PlannedSlot[], dailyMinutes: { [localDate]: minutes }) -> Figures

Figures = {
  adherence_pct:         integer   // 0–100
  logged_minutes:        integer
  target_minutes:        integer
  planned_days:          integer
  planned_days_worked:   integer
  target_met_days:       integer
  extra_off_day_minutes: integer
  over_target_minutes:   integer
  planned_weeks:         integer   // flexible only; 0 on a fixed schedule
  target_met_weeks:      integer   // flexible only; 0 on a fixed schedule
}
```

`dailyMinutes` is the objective's effort summed per local date (`effort_entry.local_date`,
NFR-12): every entry, paused days and off days included.

---

## The rule

Each slot is a **day** (fixed schedule) or a **week** (flexible schedule) with a target
in minutes, and it carries the days inside it the objective was active on.

1. **Target** = the sum of every slot's target minutes. Paused stretches have no slots,
   so they ask for nothing. A new objective has a real target before anything is
   logged.
2. **Logged** = every minute logged, on any day.
3. **Credited** = for each slot, the minutes logged on its active days, **capped at the
   slot's target**. A long day cannot make up a missed one: two hours on Monday
   against a one-hour target credits one hour.
4. **Adherence** = credited ÷ target, as a whole percentage, rounded. With no target at
   all (every planned day paused), adherence is 0, not a division by zero.
5. **Extra, off days** = minutes logged on a day **no slot covers**: an off day of a
   fixed schedule, a paused day, a day after the plan ended. They count in *logged*
   and here, and **never in adherence**.
6. **Planned days**
   - a day slot is one planned day; a week slot is its `target_days`.
   - *worked*: a day slot with any minutes; a week, its active days with any minutes,
     capped at `target_days`.
   - *target met*: a day slot whose minutes reach its target; a week, its active days
     whose minutes reach the per-day target, capped at `target_days`.

7. **Over target** = for each slot, the minutes logged on its active days **above the
   slot's target** — what rule 3 does not credit. Never in adherence. *(I-03.)*
8. **Weeks** (flexible schedules) = the week slots in the span; *met* are those whose
   minutes reach the week's target. A day slot is never a week, so a fixed schedule
   reads 0 and 0. *(I-03.)*

So every minute logged lands in exactly one place:
**logged = credited + over target + extra on off days.** A test that checks that sum
catches any rule that counts a minute twice or loses one.

The cap in 6 is the flexible schedule's version of rule 3: working five days of a
three-day week is three planned days worked, not five.

---

## Worked examples

Fixed Mon–Fri, 60 minutes a day, one week (target 300 minutes, 5 planned days):

| Logged | Credited | Adherence | Worked | Met | Extra | Over |
|---|---|---|---|---|---|---|
| nothing | 0 | **0%** of 300 | 0 | 0 | 0 | 0 |
| Mon 60, Tue 30 | 90 | **30%** | 2 | 1 | 0 | 0 |
| Mon 120 | 60 (capped) | **20%** | 1 | 1 | 0 | 60 |
| Mon 60, Sat 45 | 60 | **20%** | 1 | 1 | 45 | 0 |

Flexible, 3 days a week, 60 minutes a day (one week: target 180, 3 planned days):

| Logged | Credited | Adherence | Worked | Met | Over | Weeks met |
|---|---|---|---|---|---|---|
| Mon 60, Wed 60, Fri 60 | 180 | **100%** | 3 | 3 | 0 | 1 of 1 |
| Mon 60, Tue 60, Wed 60, Thu 60 | 180 (capped) | **100%** | 3 (capped) | 3 (capped) | 60 | 1 of 1 |
| Mon 30, Thu 60 | 90 | **50%** | 2 | 1 | 0 | 0 of 1 |

Paused Wednesday to Friday of the fixed week: the plan asks for Mon and Tue only
(target 120). 60 logged on Thursday is extra, and adherence is credited ÷ 120.

---

## Over a window

A review, a plan week and the plan so far each ask for the figures over part of the
run. They hand this rule **the slots that start in the window** and **the minutes on
the window's days**, and count as extra only the days **no slot of the whole plan**
covers — so a day whose slot started before the window is not extra. One function,
`windowFigures(window, slots, dailyMinutes)`, does this for every caller.

The sum holds only when every slot covering a day of the window also starts in it. A
plan week always meets that, because weeks and week slots tile from the same segment
start. A monthly review window can cut a flexible week in two; those minutes are
lost (`docs/intents/TRIAGE.md`).

## So far *(I-03)*

The whole-run figures count days not yet reached (decision 2), so on day 14 of 30 a
perfect record reads about 47%. **Figures to date** are the same rule over the plan so
far:

- the slots whose period ended **before today**, plus **today's day slot** — so a
  fixed objective's today counts as soon as it is today;
- the minutes on those slots' days, plus extra on uncovered days up to today.

**A flexible week counts once it has ended.** A week still in progress is left out —
its target *and* its minutes — so it never lowers the score and the sum still holds.
Mid-week, a flexible objective's logged-so-far stops at its last full week.

## Track *(I-03)*

One band over the figures to date, so every screen that shows one agrees:

| Adherence so far | Track |
|---|---|
| 80% or more | `on_track` |
| 60–79% | `at_risk` |
| below 60% | `behind` |
| no slot has ended yet | none — the objective started today or has not started |

## Plan weeks *(I-03)*

The Effort tab and the reviews show the run week by week. A **plan week** is seven
days tiled from each segment's start, the last one clipped to the segment's end — the
same tiling as flexible week slots and weekly review windows. Each week's figures are
`windowFigures` over it. A week in progress carries its whole target; the screen
labels it "so far".

---

## Edge cases the tests must carry

These extend ADR-007's named list for `adherence`.

- Zero slots: target 0, adherence 0, and logged minutes still counted (as extra).
- Zero entries: adherence 0 against a real target.
- Logged over target on one slot: capped, never above 100%.
- Off-day minutes counted in logged and extra, never in adherence.
- A flexible week counted by days: worked and met capped at `target_days`.
- A paused stretch: no target asked, its minutes extra.
- **logged = credited + over target + extra** for every case above, for a window, and
  for the figures to date with a flexible week in progress.
- Figures to date at day 14 of 30 with every day met: 100%, not 47%.
- Track at 80, 79, 60 and 59%, and with no slot ended.

---

## Decisions taken here (Rohit, I-01 planning, 2026-10-07)

1. **Minutes, capped per slot.** Not uncapped, because a long day would hide a missed
   one. Not days for flexible and minutes for fixed, because one percentage would carry
   two units across an extension that changes mode.
2. **The target is the whole span handed in**, including days not yet reached. For an
   objective that is the whole run, so the figure reads "of the plan", not "so far".
   *(I-03 added the figures to date beside it; this rule did not change.)*
3. **Rounded to a whole percent.** The screens show whole percentages.
