# Keel — entity model and invariants

Sprint 00 · Story W2-09 · **Revision 3** · 10 entities, 17 invariants, 0 stored aggregates

Built against the current 15 screens. **NFR-06 (offline logging) is out of scope for v1.**

## What revision 3 changed

ADR-008 settled D-10: **store the facts; compute everything that follows from
them.** Two entries in this model were derivations pretending to be facts.

- **`plan_slot` is gone.** It held `generateSlots` output. It was defensible only
  while pause history was unrecoverable — `status_event` makes slots re-derivable
  from `(segment, status events)`, so they are computed at read time and never
  stored. Invariants 9 and 10 now talk about generated slots as *values*.
- **`objective.status` is gone.** The current status is the latest status event.
  A column plus a history is two authorities on one truth.
- `status_event` was already in this model and its shape is unchanged; what
  changed is its weight. It was the history panel's source; it is now where the
  objective's status lives and half the input to slot generation, so its
  local-date and append-only rules are written down here for the first time.
- The entity count went from 11 to 10. It was never a target.

**The schema matches this revision** (W4-30). It took three stories, in the
expand-migrate-contract order ADR-004 requires: W4-10 added `status_event` and gave
every objective a `created` event; W4-29 moved every reader off `plan_slot` and
`objective.status`; W4-30 dropped them, and the `objective_status` and
`period_kind` types with them (`migrations/1790338443477_drop-plan-slot-and-objective-status.cjs`).

## What revision 2 changed

Review found two things. The Review table was missing four fields visible on screen (`what_went_right`, `what_needs_improvement`, `review_summary`, plus the plan-end criteria assessment). Chasing those surfaced a structural error:

- **`plan_segment` is new.** The Continue dialog carries its own schedule — *"change anything that is no longer true, Wednesdays for instance"* — so a schedule is a versioned thing, not a property of the objective. Objective no longer holds schedule fields or an end date; those live on segments and the objective's dates are derived from them.
- **`parked_idea_verdict` is new.** The review detail screen has a column headed *status then*. A current-verdict column cannot answer that, and verdicts can flip — a dropped idea can be revived.
- The entity count went from 9 to 11. It was never a target.

## Decisions this model rests on

- **A deviation belongs to a user and a date, not an objective.**
- **An extension must reach a date strictly in the future** — refused, not adjusted.
- **Only a plan-end review may change the plan.**

## The shape
```mermaid
erDiagram
    USER ||--o{ OBJECTIVE : owns
    USER ||--o{ DEVIATION : records
    USER ||--o{ PARKED_IDEA : parks
    USER ||--o{ DEVIATION_PATTERN : names
    OBJECTIVE ||--|{ PLAN_SEGMENT : "is planned over"
    OBJECTIVE ||--o{ EFFORT_ENTRY : receives
    OBJECTIVE ||--o{ REVIEW : "is reviewed by"
    OBJECTIVE ||--o{ STATUS_EVENT : "changes through"
    REVIEW |o--o{ PLAN_SEGMENT : extends
    REVIEW |o--o{ DEVIATION : judges
    REVIEW |o--o| REVIEW : answers
    DEVIATION_PATTERN |o--o{ DEVIATION : classifies
    PARKED_IDEA ||--o{ PARKED_IDEA_VERDICT : "is judged by"
    PARKED_IDEA |o--o| OBJECTIVE : becomes
```

Plan slots are **not** here: a segment plus its status events generates them at
read time (ADR-008).

## Full model
```mermaid
erDiagram
    USER {
        uuid id PK
        citext email UK
        text password_hash
        text tz
    }
    OBJECTIVE {
        uuid id PK
        uuid user_id FK
        text title
        text description
        text why_now
        text success_criteria
        text plan_link
        enum review_cadence
        uuid from_parked_idea_id FK
    }
    PLAN_SEGMENT {
        uuid id PK
        uuid objective_id FK
        int2 seq
        enum schedule_mode
        int2 planned_weekdays
        int2 days_per_week
        int minutes_per_planned_day
        date start_date
        date end_date
        text reason
        uuid created_by_review_id FK
    }
    EFFORT_ENTRY {
        uuid id PK
        uuid objective_id FK
        date local_date
        time occurred_at_local
        timestamptz logged_at
        text tz
        int minutes
        text note
        text link
    }
    REVIEW {
        uuid id PK
        uuid objective_id FK
        enum kind
        date period_start
        date period_end
        date due_on
        enum status
        uuid previous_review_id FK
        enum improvement_answer
        text improvement_answer_note
        text what_went_right
        text what_needs_improvement
        text review_summary
        text criteria_assessment
        enum criteria_verdict
        enum outcome
        timestamptz saved_at
    }
    DEVIATION {
        uuid id PK
        uuid user_id FK
        date local_date
        enum kind
        text what_happened
        text reasoning
        text did_instead
        int minutes
        uuid pattern_id FK
        enum verdict
        uuid verdict_review_id FK
    }
    DEVIATION_PATTERN {
        uuid id PK
        uuid user_id FK
        text name
    }
    PARKED_IDEA {
        uuid id PK
        uuid user_id FK
        text idea
        text why
        date caught_on
        date locked_until
        uuid became_objective_id FK
    }
    PARKED_IDEA_VERDICT {
        uuid id PK
        uuid parked_idea_id FK
        enum verdict
        text note
        date occurred_on
    }
    STATUS_EVENT {
        uuid id PK
        uuid objective_id FK
        date occurred_on
        enum change
        text reason
    }
    USER ||--o{ OBJECTIVE : owns
    USER ||--o{ DEVIATION : records
    USER ||--o{ PARKED_IDEA : parks
    USER ||--o{ DEVIATION_PATTERN : names
    OBJECTIVE ||--|{ PLAN_SEGMENT : "is planned over"
    OBJECTIVE ||--o{ EFFORT_ENTRY : receives
    OBJECTIVE ||--o{ REVIEW : "is reviewed by"
    OBJECTIVE ||--o{ STATUS_EVENT : "changes through"
    REVIEW |o--o{ PLAN_SEGMENT : extends
    REVIEW |o--o{ DEVIATION : judges
    REVIEW |o--o| REVIEW : answers
    DEVIATION_PATTERN |o--o{ DEVIATION : classifies
    PARKED_IDEA ||--o{ PARKED_IDEA_VERDICT : "is judged by"
    PARKED_IDEA |o--o| OBJECTIVE : becomes
```

## Entities

### Objective — `objective`

What you committed to. Note what is *not* here: no schedule, no end date. Those moved to plan segments, because an extension can change them.

| Column | Type | Why |
|---|---|---|
| id | uuid PK |  |
| user_id | uuid FK -> user | Every query filters on this (NFR-10). |
| title / description / why_now / success_criteria | text | From the New objective screen. |
| plan_link | text null | The external spreadsheet. Keel stores the link, never the plan. |
| review_cadence | enum('weekly','monthly') | A plan-end review is always created regardless of cadence. |
| from_parked_idea_id | uuid null FK | Drives the "FROM PARKING LOT" badge on the objectives list. |
| — not stored — |  | **Current status** is the latest status event — there is no status column (ADR-008). **Current end date** is the latest segment's end. **Original end date** is segment 0's end. **Extension count** is a row count. **The plan slots** for any date range. All derived. |

### Plan segment — `plan_segment`

**The correction.** The Continue dialog carries its own schedule — "change anything that is no longer true, Wednesdays for instance" — so a schedule is a versioned thing, not a property of the objective.

| Column | Type | Why |
|---|---|---|
| id | uuid PK |  |
| objective_id | uuid FK |  |
| seq | int2 | 0 is the original plan. 1, 2, 3 are extensions — this is what "Extension 2" and "extended 3 times" read from. |
| schedule_mode | enum('fixed','flexible') | Can differ from the previous segment. That is the whole point. |
| planned_weekdays | int2 null | Bitmask Mon–Sun. Null when flexible. |
| days_per_week | int2 null | Null when fixed. |
| minutes_per_planned_day | int |  |
| start_date / end_date | date | Contiguous with the previous segment; never overlapping. |
| reason | text | **NOT NULL.** The Continue dialog marks "why extend rather than complete?" as required, so the schema should too. Segment 0's reason is the objective's creation reason. |
| created_by_review_id | uuid null FK | Null on segment 0. Set by the plan-end review that extended. |

### Plan slots — not an entity

**Dropped in revision 3 (ADR-008).** A planned unit — a day for a fixed segment, a
week for a flexible one — is a *value* computed by
`generateSlots(segment, statusEvents)` in `domain/`, never a row. It carries the
same fields it always did (`period_kind`, `period_start`/`period_end`,
`target_minutes`, `target_days`), and it belongs to a segment, which is how it
inherits the schedule in force at the time. Nothing writes it down.

### Effort entry — `effort_entry`

What you actually did. Several per day per objective is normal.

| Column | Type | Why |
|---|---|---|
| id | uuid PK |  |
| objective_id | uuid FK | On the objective, not the segment — effort survives a schedule change. |
| local_date | date | **The day you meant.** Stored, never derived, never moves (NFR-12). |
| occurred_at_local | time null | The WHEN column — when the work happened, which is not when you logged it. |
| logged_at | timestamptz | The instant the row was written. |
| tz | text | The zone it was logged in, e.g. Asia/Kolkata. |
| minutes | int |  |
| note | text | "what you did". |
| link | text null | "#d14a", "#keel/32". |

### Review — `review`

Per objective, per period. The three free-text fields are marked on screen as *reviewed outside Keel; recorded here* — they are your judgement from the plan spreadsheet, which is why Keel cannot compute them.

| Column | Type | Why |
|---|---|---|
| id | uuid PK |  |
| objective_id | uuid FK |  |
| kind | enum('weekly','monthly','plan_end') |  |
| period_start / period_end | date | Every figure on the screen covers this window only. |
| due_on | date |  |
| status | enum('draft','saved') | The draft is S24. At most one per objective and period. |
| previous_review_id | uuid null FK | Whose `what_needs_improvement` this one answers. |
| improvement_answer | enum('yes','partly','no') null | "Did it happen?" |
| improvement_answer_note | text null |  |
| what_went_right | text null | **Was missing.** From the plan spreadsheet. |
| what_needs_improvement | text null | **Was missing.** This is the sentence the *next* review quotes back at you, and the one "the sentence that repeats" is detected from. |
| review_summary | text null | **Was missing.** The one line shown in the reviews list. |
| criteria_assessment | text null | **Was missing.** Plan-end only — "two of three, one still with notes open". A weekly review says explicitly that it does not assess this. |
| criteria_verdict | enum('met','partly_met','not_met') null | **Was missing.** Plan-end only. Drives "Completed · partly met". |
| outcome | enum('continued','completed','paused','ended') null | Plan-end only. |
| saved_at | timestamptz null | Null while a draft. |
| — not stored — |  | Adherence, logged/target, planned days, target met, the per-day bars, deviation costs, "review 7 of the plan". All recomputed when the review is opened. |

### Deviation — `deviation`

Belongs to you and a date — not to an objective. Your call, and it matches the screen as drawn.

| Column | Type | Why |
|---|---|---|
| id | uuid PK |  |
| user_id | uuid FK | No objective_id. |
| local_date | date |  |
| kind | enum('chosen','drifted') |  |
| what_happened / reasoning / did_instead | text | Reasoning is recorded now and tested at review. |
| minutes | int | The cost. Never subtracted from effort — a separate ledger. |
| pattern_id | uuid null FK | Null means "a genuine one-off", which is a real answer. |
| verdict | enum('worth_it','not_worth_it') null | Chosen deviations only. |
| verdict_review_id | uuid null FK | Which review judged it. Null together with verdict. |

### Parked idea — `parked_idea`

The lock is the point. An idea you cannot act on for three weeks is an idea you can judge honestly.

| Column | Type | Why |
|---|---|---|
| id | uuid PK |  |
| user_id | uuid FK |  |
| idea / why | text | "The honest reason — this is the part worth having later." |
| caught_on | date |  |
| locked_until | date | Set when parked. Never moves. |
| became_objective_id | uuid null FK | Set when a verdict of 'taken' is recorded. |
| — not stored — |  | **The current verdict.** It is the latest verdict event — see below. |

### Parked idea verdict — `parked_idea_verdict`

**The second correction.** The review detail screen has a column headed *status then*. A current-verdict column cannot answer that, and verdicts can flip — a dropped idea can be revived.

| Column | Type | Why |
|---|---|---|
| id | uuid PK |  |
| parked_idea_id | uuid FK |  |
| verdict | enum('parked','taken','dropped') |  |
| note | text null | "why it ended" — edited on the row. |
| occurred_on | date | Current verdict = the latest row. *Status then* = the latest row on or before the review's period end. |

### Deviation pattern — `deviation_pattern`

A named shape you recognise — "Planning instead of doing". The "3 before" count is computed, never stored.

| Column | Type | Why |
|---|---|---|
| id / user_id / name |  |  |

### Status event — `status_event`

Created, paused, resumed, completed, ended — with the reason given at the time.
**Load-bearing since revision 3:** this is where the objective's current status
lives, and it is half the input to slot generation (ADR-008).

| Column | Type | Why |
|---|---|---|
| id | uuid PK |  |
| objective_id | uuid FK |  |
| occurred_on | date | **A local date**, the day the change happened in the user's zone — the same discipline as `effort_entry.local_date`, set by the client and never moved (NFR-12). |
| change | enum('created','paused','resumed','completed','ended') | **No 'extended'.** An extension is a plan segment; the history panel is the two lists merged by date. Storing it twice is how the panel grows duplicate rows. |
| reason | text null | Optional — some rows on the screen are blank. |

**Append-only.** Nothing updates or deletes a row: a correction is another event
(NFR-01). Every objective has a `created` event (invariant 16).

**Why no `tz` here, when `effort_entry` has one.** An effort entry records two
different things — the day you meant (`local_date`) and the instant it was written
(`logged_at`) — so it needs `tz` to relate them. A status change records only the
day it happened on. There is no second timestamp to reconcile it with, so a zone
would be stored and never read.

### User — `user`

| Column | Type | Why |
|---|---|---|
| id | uuid PK |  |
| email | citext UK |  |
| password_hash | text |  |
| tz | text | The zone new entries are stamped with by default. |

## Invariants

1. **Ownership.** Every plan segment, effort entry, review and status event belongs to exactly one objective, and every objective, deviation, parked idea and pattern belongs to exactly one user. No row is reachable without passing through a user. *(NFR-10)*
2. **The day never moves.** An effort entry's `local_date` is set when it is written and never changes — not when the user travels, not across a daylight-saving boundary, not when the row is edited. *(NFR-12)*
3. **The schedule lives on the segment.** An objective has no schedule and no end date of its own. Its current end date is the end date of its latest segment; its original end date is segment 0's. Neither is stored, so neither can disagree with the segments.
4. **Segments are contiguous and never overlap.** Segment *n* starts the day after segment *n−1* ends. No two segments of one objective cover the same date, and there are no gaps.
5. **Every extension carries a reason.** `plan_segment.reason` is NOT NULL. The Continue dialog marks "why extend rather than complete?" as required, and a required field on the screen should be a required column in the schema.
6. **An extension must reach into the future.** A new segment's end date is strictly after the day it is created. An extension that would end in the past is refused, not silently adjusted. *(Your answer, Q5)*
7. **Only the plan-end review decides.** Only a review of kind `plan_end` may carry an outcome, a criteria verdict, or create a plan segment. Weekly and monthly reviews record and judge; they never change the plan. *(Your answer, Q8)*
8. **Criteria are judged once, at the end.** `criteria_assessment` and `criteria_verdict` are null on every weekly and monthly review. The screen says so in words; the schema should say it in constraints.
9. **One plan per period.** Generating an objective's slots never yields two covering the same day or week. A fixed segment produces day slots; a flexible one produces week slots; never both within one segment. Nothing enforces this in the database — slots are values now, so this is a property of `generateSlots` and is tested as one *(ADR-008)*.
10. **Slots follow the status.** A generated slot exists only for dates inside its segment and only for stretches the objective was active, according to its status events. Pausing suppresses slots for the paused stretch; resuming produces them again. Effort logged while paused is covered by no slot and therefore counts as extra. Because slots are derived, this can no longer drift from the status history — it *is* the status history *(ADR-008)*.
11. **A deviation belongs to a day, not an objective.** A deviation has no objective. A review shows every deviation whose `local_date` falls inside its period, so one deviation may appear in three objectives' reviews at once. That is correct: you did not go off one objective, you went off. *(Your answer)*
12. **Only chosen deviations are judged.** A verdict may exist only on a deviation of kind `chosen`, and must name the review that gave it. Verdict and `verdict_review_id` are null together or set together. Once saved, a later review never changes it. *(NFR-01)*
13. **Verdicts accumulate, they do not overwrite.** A parked idea's verdict history is append-only. The current verdict is the latest row; the verdict a review shows is the latest row on or before that review's period end. Reviving a dropped idea adds a row, it does not edit one. *(NFR-01)*
14. **One draft, and it holds no figures.** At most one draft review per objective and period; saving replaces it. A draft stores answers only — adherence, totals, the per-day bars and deviation costs are recomputed every time the review is opened.
15. **Nothing is ever counted twice.** No adherence, total, streak, extension count or sequence number is stored anywhere. Every figure on every screen — including "longest streak", "review 7 of the plan" and "the sentence that repeats" — is computed at read time. *(NFR-09)*
16. **Every objective starts with a `created` event.** An objective's status is the latest status event, so an objective with no events has no status rather than a default one. The `created` event is written in the same transaction as the objective, and the W4-10 migration backfills one for every objective that predates `status_event`. *(ADR-008)*
17. **Nothing is deleted.** There is no delete for an objective, a review, a deviation or a parked idea. An objective can be completed or ended; a review can be discarded only while it is a draft. The record is the product. *(NFR-01)*

## Modelling calls worth challenging

- **Plan slots are derived, not stored** — *reversed in revision 3.* Revision 2 argued for storing them: pause and resume mean planned days are not a function of the schedule alone, so a slot could not be re-derived and had to be frozen. `status_event` removes that objection, and storing the generator's output left two copies of one rule. ADR-008 has the full argument and the cost: with nothing frozen, fixing a bug in `generateSlots` changes what the past *was*.
- **Effort entries carry no link to a plan slot.** An entry is "extra" when its objective's segment is fixed-schedule and no generated day slot covers its date. Deriving this rather than storing a foreign key removes a way for the two to disagree. One consequence to accept deliberately: **effort logged while an objective is paused reads as extra**, because no slot is generated for those days.
- **The status history panel is a merge, not a table.** It shows created, paused, resumed, completed and ended from `status_event`, interleaved by date with extensions from `plan_segment`. Neither table stores the other's rows. If an extension were also written as a status event, the panel would eventually show it twice and no constraint would catch it.

## What changed because NFR-06 is out of scope

Removed: a sync queue table, a client-created timestamp distinct from the server's, and a conflict rule for two devices logging the same day. The phone/laptop question is closed **by scope, not by design**. The primary key is freed too — `uuid` is kept because it costs little and preserves the option, but `bigint` is defensible. **NFR-12 is untouched.**

## Ready for the API contract

The Today query is one read: objectives joined through their current plan segment to that date's entries, plus the status events the slot generator needs, filtered by user. The day's planned slot is computed from those rows, not joined to. That is still one round trip, which is what NFR-03 constrains — with revision 3 part of the budget moves from the query into a pure function. Remaining open item: Q7 (does off-day logging need confirming) — a UI question, not a data one.