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
  `adherence` / figures rules over the days the window covers.
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

1. **Tile from the start.** Lay consecutive windows beginning at S.
   - *weekly:* window *k* is `[S + 7k, S + 7k + 6]`.
   - *monthly:* window *k* is `[addMonths(S, k), addMonths(S, k+1) − 1 day]`.
     `addMonths` clamps a day that overflows the target month to that month's last
     day: `addMonths(Jan 31, 1) = Feb 28` (or 29). Monthly windows are therefore
     28–31 days; weekly windows are always 7.
2. **Clip the last window to E.** The final window ends at E, whatever its natural
   length — so it may be short (a partial final period).
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

---

## Worked examples

Assume weekly cadence unless stated. Dates written `MM-DD`.

| Plan | Windows produced |
|---|---|
| **Start 09-01, end 09-21 (21 days)** | Week 1 `09-01…09-07` · Week 2 `09-08…09-14` · **End of plan** `09-15…09-21` (a full week, but it ends at E, so it is the plan-end review) |
| **Start 09-01, end 09-30 (30 days)** | Week 1…Week 4 (`09-01…09-28`) · **End of plan** `09-29…09-30` (2-day tail) |
| **Start 09-01, end 09-04 (4 days)** | **End of plan** `09-01…09-04` only — shorter than one week, nothing numbered |
| **Weekly, paused 09-08…09-14 entirely** | Windows unchanged; Week 2 `09-08…09-14` has zero planned days and is **never surfaced as due** |
| **Weekly, paused 09-10…09-12 (mid-window)** | Week 2 `09-08…09-14` still due, with a lower target for the three paused days |
| **Monthly, start 01-31** | Month 1 `01-31…02-27` (`addMonths(01-31,1)=02-28`, minus a day) · Month 2 `02-28…03-30` · … |
| **Extended: seg 0 ends 09-21, seg 1 09-22…10-12** | seg 0: Week 1, Week 2, End of plan `09-15…09-21`; seg 1: **Week 3** `09-22…09-28`, Week 4 `09-29…10-05`, End of plan `10-06…10-12` — weeks continue, second plan-end review appears |

---

## Edge cases the tests must carry

These extend ADR-007's named list for `reviewWindows`.

- Weekly and monthly cadence both produce a correct final `plan_end` window.
- Partial final window (E not on a boundary) vs. exact final window (E on a
  boundary) — both must type the last window `plan_end`, never a numbered one.
- A segment shorter than one window → single `plan_end`, no numbered windows.
- `addMonths` clamping at month ends (Jan 31 → Feb; leap vs non-leap February).
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

---

## Decisions taken here (veto any that are wrong)

1. **Windows are calendar-anchored at the segment start; pauses never move a
   boundary.** Empty windows are dropped by the due predicate, not by shifting.
2. **The last window is always the plan-end review**, even when it is a full week.
3. **Monthly = true calendar months** with end-of-month clamping, not fixed 28-day
   blocks.
4. **Labels run continuously across segments** (G-08), each segment keeping its own
   *End of plan*.
5. **A review is due on its `period_end` day**, not before.

1–5 are product calls as much as engineering ones; the rest of the rule follows from
the ERD and the contract and is not up for debate.
