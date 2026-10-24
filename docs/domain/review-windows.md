# Domain rule — `reviewWindows`

**Closes:** G-06 · **Feeds:** G-05 (server picks the due period), G-07
(`previous_review_id`), G-08 (labels across an extension) · **Epic:** E-02 ·
**Layer:** `src/**/domain/**` — pure, no I/O.

The one rule that turns a cadence and a plan into the dated review windows the
whole review flow hangs off. `POST /objectives/{objectiveId}/reviews` with no body
calls it to decide which period is due; the review screen's figures are computed
over the window it returns. Nothing about a window is stored — a window is a
function of the segment's dates and the cadence, recomputed on read, exactly as the
ERD already decided for "review 7 of the plan".

---

## What it is not

- **Not stored.** No `review_period` table, no periods written at objective
  creation. Storing them would duplicate this rule's output and force a rewrite of
  every future period on a pause or an extension — the drift the ERD is built to
  prevent. A `review` row is created only when a review is actually started, and it
  freezes its own `period_start` / `period_end` at that moment.
- **Not the figures.** This rule returns boundaries and labels only. Adherence,
  logged-vs-target, the per-day bars, deviation costs — all computed by the
  `adherence` / figures rules over the days the window covers (the whole plan, for a
  plan-end review — below).
- **Not aware of the clock.** `reviewWindows` is a pure function of the plan. Which
  window is *due* is a separate, thin predicate that takes today's local date and
  the saved reviews (below).

---

## Signature

```
reviewWindows(cadence: 'weekly' | 'monthly', segment: PlanSegment) -> Window[]

Window = {
  segment_id:   uuid
  kind:         'weekly' | 'monthly' | 'plan_end'
  seq_in_seg:   integer      // 0-based, order within the segment
  period_start: LocalDate
  period_end:   LocalDate    // inclusive
}
```

Per **segment**, matching the backlog signature. Labels and `previous_review_id`
are assigned one level up, across the whole objective, because both run continuously
across an extension (see *Objective-level assembly*).

All dates are **local dates** (`DATE`, no time, no zone) and all comparisons are
local-date comparisons — the same discipline as NFR-12. A window never carries an
instant.

---

## The rule

Given a segment with `start_date` **S** and `end_date` **E** (inclusive, S ≤ E):

1. **Tile by the calendar.** *(I-09.)* Lay the calendar periods that overlap
   `[S, E]`, clipping the first to start at S and the last to end at E.
   - *weekly:* Monday-to-Sunday weeks.
   - *monthly:* calendar months, the 1st to the month's last day.
2. **Join a short first and last period.** *(I-09.)* A period is **short** when it has
   fewer than **4** days (weekly) or fewer than **15** days (monthly) — under half a
   full one. A short first window joins the window after it; a short last window joins
   the window before it. So a joined weekly window runs up to 10 days, a monthly one up
   to 45. When joining leaves one window, it is `[S, E]`.
3. **The last window is the plan-end review.** Whichever window ends at E is typed
   `plan_end` and labelled *End of plan*, **not** by cadence — even when it is a
   full-length week. Every earlier window keeps the cadence kind (`weekly` /
   `monthly`). This is why the reviews list reads *Week 1 · Week 2 · Week 3 · End of
   plan*: the last row is the plan-end review, not a fourth week. A plan-end review
   always exists, for any cadence, per the ERD.
4. **A segment shorter than one window** yields a single `plan_end` window `[S, E]`
   and nothing numbered.

Pauses do **not** enter this function — see below.

### Pauses shift nothing; they empty windows

A pause stops slot generation, so a window that overlaps a paused stretch simply has
fewer planned days and a lower target. Window **boundaries do not move** — that keeps
`reviewWindows` a pure function of `(cadence, segment)` and keeps every window a
fixed, testable calendar span.

The consequence a user would otherwise hate — an empty "review" for a fortnight's
holiday — is handled where it belongs, in the *due* predicate: a window with **zero
planned days is never surfaced as due**. So a fully-paused window is skipped without
ever bending a boundary. A window that is only partly paused still has planned days,
so it is still reviewed, over its real (lower) target.

*(Alternative considered: advance the window clock only on active days, so a pause
literally slides later windows. Rejected — it makes `reviewWindows` depend on the
status history, breaks the backlog's `(cadence, segment)` signature, and multiplies
the edge cases, all to buy something the zero-planned-days skip already delivers.)*

---

## Objective-level assembly

An objective is one or more contiguous segments. Concatenate each segment's windows
in date order, then:

- **Labels (G-08) run continuously across the whole objective.** Numbering does not
  restart per segment: `Week 1 … Week 3`, `End of plan` (segment 0), then
  `Week 4 …`, `End of plan` (segment 1). Each segment keeps its own `plan_end`
  window; they are told apart by date, not by the label. *Continuous, not
  per-segment* is the G-08 decision — it matches the reviews list, which shows weeks
  continuing after an extension.
- **`previous_review_id` (G-07)** is set at save time to the most recent **saved**
  review of the objective whose `period_end` is before this window's `period_start`.
  Taking the most recent *saved* review — not merely the previous window — means the
  "last week you said this needed improvement" chain skips periods that were never
  reviewed, instead of pointing at an empty draft that never existed.

The assembler is still pure: `reviewSchedule(objective, segments)` →
`{ window, label, kind }[]`. It reads no clock and no entries.

---

## Which window is due

A separate predicate, given the assembled windows, today's **local** date, the
objective's status and its saved reviews:

> The due window is the **earliest** window that has **closed** (`today ≥
> period_end`), is **not yet saved**, and contains **at least one planned day**,
> while the objective is **active**.

- Closed on its `period_end` day — that day *is* "due today". A window still in
  progress is not due.
- `period_end` is the window's own `due_on`; no separate field is stored.
- Zero-planned-day windows are skipped (the pause rule above).
- Paused / completed / ended objectives surface nothing as due. On resume, any
  window that closed during the pause and has planned days becomes due, oldest
  first.
- None due → `POST …/reviews` with no body returns **422** (already in the
  contract).

`next_review_on` on `ObjectiveSummary` is the `due_on` of this same window (or null
when none is due) — one rule, two readers.

**How many are due.** `reviews_due` on `ObjectiveSummary` is the number of windows that
satisfy the same predicate — every closed, unsaved window with a planned day, not just
the earliest. It is `0` exactly when `next_review_on` is null, and it is computed, never
stored (invariant 15). A paused objective shows `0` like it shows no due date; the
windows it owes come back, and are counted, on resume.

**Which ones are due.** `GET /objectives/{objectiveId}/reviews` lists the same windows
as `due`, oldest first, each with its label, kind and period, and the draft's id when
one has been started — so the Reviews tab shows one card per owed review without
re-deriving windows in the client. *(I-03.)*

---

## The next review, due or not *(I-03)*

Onboarding and an empty Reviews tab say when the first review falls before any is due.
`upcoming_review_on` is the `period_end` of the **earliest window without a saved
review**, whether or not it has closed:

- a window that has **closed with no planned day** is skipped — it can never become
  due, so it would otherwise stick;
- `null` once every window is saved, and once the objective is completed or ended. A
  paused objective still shows one.

`next_review_on` keeps its meaning — the earliest **due** window. Once something is
due, the two agree.

## The review that will judge a deviation *(I-03)*

A chosen deviation is judged at a review of one of the objectives it names
(invariant 12). `review_due_on` is the earliest `period_end` among the windows, across
those objectives, whose period contains the deviation's `local_date`. It ignores
whether a review has been saved: it says which review the deviation falls in, not
whether that review has happened. Null when no window covers the date.

## The figures a plan-end review shows *(I-03)*

A weekly or monthly review's figures cover its own window. A **plan-end review's
figures and adherence cover the whole plan**, from the objective's first day to the
review's `period_end` — the final review asks how the plan went, not how its last week
did. After an extension, the second plan-end review covers both segments.

Its per-day bars, its deviations and the change it quotes back stay on its own window.
The window boundaries do not change; only the span handed to the figures does.

---

## Worked examples

Assume weekly cadence unless stated. Dates written `MM-DD`.

| Plan | Windows produced |
|---|---|
| **Mon 09-07 to Sun 09-27 (21 days)** | Week 1 `09-07…09-13` · Week 2 `09-14…09-20` · **End of plan** `09-21…09-27` (a full week, but it ends at E, so it is the plan-end review) |
| **Thu 09-03 to Wed 09-30** | Week 1 `09-03…09-06` (4 days, not short) · Week 2 `09-07…09-13` · Week 3 `09-14…09-20` · **End of plan** `09-21…09-30` (the 3-day tail `09-28…09-30` joined the week before) |
| **Sat 09-05 to Fri 10-02 (28 days)** | Week 1 `09-05…09-13` (the 2-day `09-05…09-06` joined the next week) · Week 2 `09-14…09-20` · Week 3 `09-21…09-27` · **End of plan** `09-28…10-02` (5 days, not short) |
| **Sat 09-05 to Tue 09-08 (4 days)** | **End of plan** `09-05…09-08` only — two short weeks joined, nothing numbered |
| **Weekly, Mon 09-07 start, paused 09-14…09-20 entirely** | Windows unchanged; Week 2 `09-14…09-20` has zero planned days and is **never surfaced as due** |
| **Weekly, paused 09-16…09-18 (mid-window)** | Week 2 `09-14…09-20` still due, with a lower target for the three paused days |
| **Monthly, 09-10 to 12-09** | Month 1 `09-10…09-30` (21 days, not short) · Month 2 `10-01…10-31` · **End of plan** `11-01…12-09` (the 9-day December joined November) |
| **Monthly, start 2027-01-20** | Month 1 `01-20…02-28` (the 12-day January joined February) · … |
| **Extended: seg 0 Mon 09-07…Sun 09-27, seg 1 09-28…10-14** | seg 0: Week 1, Week 2, End of plan `09-21…09-27`; seg 1: **Week 3** `09-28…10-04`, End of plan `10-05…10-14` (the 3-day tail joined) — weeks continue, second plan-end review appears |

---

## Edge cases the tests must carry

These extend ADR-007's named list for `reviewWindows`.

- Weekly and monthly cadence both produce a correct final `plan_end` window.
- Partial final window (E not on a boundary) vs. exact final window (E on a
  boundary) — both must type the last window `plan_end`, never a numbered one.
- A segment shorter than one window → single `plan_end`, no numbered windows.
- Every start weekday, Monday to Sunday: weeks end on Sundays, and a first week of
  1–3 days joins the next one; a last week of 1–3 days joins the one before.
- Months end on the month's last day, including February in leap and non-leap years;
  a first or last month of 1–14 days joins its neighbour, of 15 or more stands alone.
- Two short windows only (Sat to Tue) join into one `plan_end`.
- A fully-paused window has zero planned days and is not due; a partly-paused window
  is due with a reduced target.
- Continuous labels across an extension boundary; a second `plan_end` for the second
  segment.
- `previous_review_id` skips an unreviewed period and points at the last *saved*
  review.
- Due selection at the exact `period_end` (due today), one day before (not due), and
  with two closed-and-unsaved windows (earliest wins).
- All boundary maths under `TZ=UTC`, `Asia/Kolkata`, `Pacific/Kiritimati`,
  `America/Los_Angeles` — identical windows (NFR-12).
- `upcoming_review_on` before anything is due, after a save, past a wholly paused
  window, and null once completed.
- `review_due_on` for a date in Week 2, for two objectives (the earlier end wins), and
  for a date no window covers.
- A plan-end review's figures equal the figures over the whole plan to its end, while
  its bars and deviations stay on its own window.

---

## Decisions taken here (veto any that are wrong)

1. **Windows follow the calendar: Monday-to-Sunday weeks and calendar months**
   *(Rohit, I-09, 2026-10-24; before, they were anchored at the segment start)*.
   Pauses never move a boundary. Empty windows are dropped by the due predicate, not
   by shifting.
2. **The last window is always the plan-end review**, even when it is a full week.
3. **A short first or last period joins its neighbour** — under 4 days for a week,
   under 15 for a month *(Rohit, I-09, 2026-10-24)*. The same rule for every segment,
   an extension's included.
4. **Labels run continuously across segments** (G-08), each segment keeping its own
   *End of plan*.
5. **A review is due on its `period_end` day**, not before.

1–5 are product calls as much as engineering ones; the rest of the rule follows from
the ERD and the contract and is not up for debate.
