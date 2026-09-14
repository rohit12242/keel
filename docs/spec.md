# Keel — v1 specification

Last revised 22 August 2026. Build starts 23 August; v1 ships 5 September.

---

## The problem

A) I do a lot of thinking, then make a plan, and when it comes to executing I do it
   for a few days, leave it, and start making a new plan.

B) When it comes to review I have only scattered written data, and some of it only in
   my head — so in the end I don't review, I just make a new plan.

C) I invest too much time on planning rather than doing things.

D) I have had the same discussion about what I should do professionally, repeatedly.
   It has taken an enormous amount of time that could have gone into the work itself.

E) I have been ungrounded most of the time.

**What Keel is.** A record of what actually happened around my effort, so that review
runs on evidence instead of memory. It is not a planner and not a place to think. The
low-level plan for each objective lives in a spreadsheet; Keel holds the record.

---

## v1 features

1. **Objectives** — several may run at once, each with its own schedule, daily target,
   success criteria and link to its plan.
2. **Log entries** — several per day, each against one objective.
3. **Schedule and adherence** — planned days versus off days; planned effort versus
   actual effort.
4. **Deviations** — declared by me, not inferred, and classified against a known pattern.
5. **Known patterns** — my named patterns, used to classify deviations.
6. **Parking lot** — ideas caught during an objective, locked until its review date.
7. **Review** — per objective and combined.
8. **Authentication** — single user.

---

## Non-goals for v1

- Job application and interview pipeline. The strongest v2 candidate; it doubles the
  data model and I need to finish something first.
- Skill-gap tracking against interview failures. Follows the pipeline; same reason.
- AI-generated insight over the effort data. I need honest raw data before anything
  interprets it.
- A research section. Research is an attribute of a day's work — a note and a link on
  an entry — not a place to go and read.
- Mobile app, sharing, accountability partners. Responsive web reaches my phone.
- Tags, categories, folders, anything hierarchical.

---

## Concepts

### Objective

Something I am committing effort to, with a schedule and an end date.
Several can be active at once.

| Field | Meaning |
|---|---|
| `title` | Short name |
| `description` | What the work actually is |
| `rationale` | Why this, why now |
| `success_criteria` | What would prove it worked — must be checkable |
| `plan_url` | Link to the spreadsheet holding the low-level plan |
| `schedule_mode` | `fixed_weekdays` or `flexible_weekly` |
| `weekdays` | For fixed mode — which days are planned |
| `days_per_week` | For flexible mode — how many days a week |
| `daily_target_minutes` | Effort planned per working day |
| `duration_days` | How long the objective runs |
| `started_on`, `review_on` | `review_on` defaults to `started_on + duration_days` |
| `status` | `active` · `paused` · `met` · `switched` · `abandoned` |
| `opening_note` | Why this was started alongside whatever was already running |

`opening_note` is only asked for when another objective is already active. Starting
a third objective in week two is the pattern in a costume; the app doesn't block it,
it records it so the review can see it.

### PlanSlot

The schedule, stored as rows rather than computed. Generated when the objective is
created; changing a schedule later affects future slots only, never history.

| Field | Meaning |
|---|---|
| `objective_id` | |
| `starts_on`, `ends_on` | One day in fixed mode; one week in flexible mode |
| `target_minutes` | Effort planned for the slot |
| `target_days` | 1 in fixed mode; e.g. 5 in flexible mode |

Both scheduling modes then answer adherence with the same query: sum the entries
falling inside a slot, compare against the slot's target.

### LogEntry

One piece of work. Several per day, each against one objective.

`objective_id` · `entry_date` · `minutes` · `note` · `link`

An entry whose date falls inside no plan slot is **extra effort** — counted and
shown, but reported separately so a good Sunday never disguises a missed Wednesday.

### Deviation

A day I went off. Declared by me, never inferred by the app.

| Field | Meaning |
|---|---|
| `occurred_on` | |
| `kind` | `drifted` — it happened to me · `chosen` — I decided, with reasoning |
| `minutes` | What it cost |
| `what_happened` | |
| `did_instead` | |
| `reasoning` | Why I chose it, for `chosen` deviations |
| `pattern_id` | Which known pattern this was, where one fits |
| `worth_it` | Set at review, looking back: `yes` · `no` · `unclear` |

Deviations are not attached to an objective. They are about the day.

`worth_it` exists because every deviation of the last two years felt reasoned at the
time. Reasoning recorded in the moment, tested later against what happened.

### Pattern

A named pattern of mine, used to classify deviations.
`name` · `tell` (how I recognise it)

Seeded with: New path looks better · Planning instead of doing ·
Post-interruption drift · Research spiral · Ungrounded.

### ParkedIdea

An idea caught while an objective was running. Global, not per objective.

`idea` · `why_it_grabbed_me` · `captured_on` · `verdict` (`took_it` · `dropped_it` ·
`still_parked`) · `verdict_on`

`why_it_grabbed_me` is the field worth having later — it is the evidence about me
rather than about the idea.

---

## Derived numbers

Nothing below is stored; all of it is computed from the rows above.

- **Adherence** — logged minutes inside plan slots, over target minutes. The headline
  number, ahead of streak.
- **Planned days met** — plan slots whose target was reached.
- **Missed planned day** — a slot that closed with nothing logged against it.
  Distinct from a deviation: one is computed, the other declared. They overlap
  sometimes and not others.
- **Extra effort** — minutes logged outside any plan slot.
- **Streak** — consecutive planned days met in fixed mode; consecutive weeks met in
  flexible mode.
- **Cost of deviations** — total minutes, split by `chosen` and `drifted`, grouped by
  pattern.

---

## Screens

1. **Today** — the objectives planned for today with their targets and progress;
   several entries per objective; objectives not scheduled today shown collapsed with
   the option to log anyway.
2. **New objective** — the form, the schedule builder, the derived plan summary, and
   the opening note when something is already running.
3. **Objective detail** — the commitment, the schedule as an attendance strip,
   adherence, and the full history with weekly subtotals against target.
4. **Log a deviation** — kind, what happened, the pattern, what it cost.
5. **Parking lot** — capture, and the locked list.
6. **Review** — per objective and combined: adherence, planned versus actual,
   deviations by kind and pattern, parked-idea verdicts, and the decision.

---

## Build order

Fixed-weekday scheduling ships in v1. Flexible weekly mode is designed into the schema
and the screens but its second code path waits until the first week it is actually
needed — the schema is the expensive thing to get right, the code path is not.

Deadline 5 September. It does not move. Scope does.
