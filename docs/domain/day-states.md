# Domain rule — day states

**Intent:** I-01 · **Implements:** `src/modules/objectives/domain/scheduleGrid.ts` ·
**Layer:** `src/**/domain/**` — pure, no I/O.

The one rule that says what a single day of an objective's plan *was*. The schedule
grid draws it (`GET /objectives/{objectiveId}/schedule`), and the review and the review
detail will draw the same per-day bars. One rule, so the overview and a review can
never colour the same day differently.

---

## What it is not

- **Not stored.** A day's state is recomputed on every read from the planned slots and
  the minutes logged that day (NFR-09). Nothing writes it down.
- **Not the plan.** Whether a day is planned is `planSlots(segments, statusEvents)`:
  the schedule, with paused stretches removed. This rule reads those slots.
- **Not the figures.** Adherence and the totals are `docs/domain/adherence.md`. Both
  rules read the same slots, so a day this rule calls `target_met` is a day the
  figures count as met.

---

## Signature

```
dayState(slot: PlannedSlot | null, loggedMinutes) -> { state, target_minutes }

state ∈ target_met | worked_short | planned_no_log | off_day | off_day_worked
```

`slot` is the planned slot whose **active days** include the date, or null when none
does. The grid applies it to every date in the requested range and adds the
`segment_id` of the segment the date falls in.

---

## The rule

**A day no slot covers.** That is an off day of a fixed schedule, a paused day of
either schedule, or a day the plan does not reach:

- nothing logged → `off_day`, target 0;
- anything logged → `off_day_worked`, target 0. This is a real state, not an error: it
  is effort the plan did not ask for.

**A fixed schedule's planned day** (a day slot), against the day's target:

- logged ≥ target → `target_met`;
- 0 < logged < target → `worked_short`;
- nothing logged → `planned_no_log`.

**A flexible schedule's day** (inside an active week slot). No single day of a
flexible week is planned; the week asks for *n* of its days. So a day is *worked or
not*, against the per-day target:

- logged ≥ the per-day target → `target_met`;
- 0 < logged < the per-day target → `worked_short`;
- nothing logged → `off_day`, target 0. **Never `planned_no_log`**: which unworked days
  the week "meant" is not knowable. The week's shortfall is in the figures
  (`planned_days_worked` of `planned_days`), not invented per day.

Every day carries `logged_minutes`, 0 when none.

---

## Worked examples

Fixed Mon–Fri, 60 minutes a day:

| Day | Logged | State | Target |
|---|---|---|---|
| Mon | 60 | `target_met` | 60 |
| Tue | 30 | `worked_short` | 60 |
| Wed | — | `planned_no_log` | 60 |
| Sat | 45 | `off_day_worked` | 0 |
| Sun | — | `off_day` | 0 |
| Thu, paused | 60 | `off_day_worked` | 0 |

Flexible, 3 days a week, 60 minutes a day:

| Day | Logged | State | Target |
|---|---|---|---|
| Mon | 60 | `target_met` | 60 |
| Tue | 20 | `worked_short` | 60 |
| Wed | — | `off_day` | 0 |
| Fri, paused | 30 | `off_day_worked` | 0 |

---

## Edge cases the tests must carry

- All five states, for a fixed schedule.
- A flexible day: met, short and unworked, with an unworked day never `planned_no_log`.
- A paused day with effort is `off_day_worked` under either schedule.
- A range across a segment boundary: each day names the segment it falls in.
- A requested range wider than the plan is clamped to the plan. A range entirely
  outside it has no days.

---

## Decisions taken here (Rohit, I-01 planning, 2026-10-07)

1. **A flexible day is worked or not.** An unworked day is `off_day`, and the week's
   shortfall shows in the figures. Not chosen: marking unworked days `planned_no_log`
   until the week's quota is met, because which days count as "planned" would be
   arbitrary.
2. **Paused days follow one rule under both schedules.** A paused day has no slot, so
   it is `off_day`, or `off_day_worked` if effort was logged.
3. **A range is clamped to the plan.** Every day in the response names a segment, and a
   day outside every segment has none to name.
