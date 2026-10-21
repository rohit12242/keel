# Where the design and the contract differ

Checked against `docs/keel-api.yaml`, `docs/domain/*.md` and ADR-002 on 20 Oct 2026. Each row needs a decision before the screen that uses it is built: change the contract, or change the design. **Blocking** means the screen can't be built as designed without it.

## Gaps

| # | Design asks for | Contract today | Suggested resolution | Blocking |
|---|---|---|---|---|
| G1 | **Sign-in, Create account and Reset password screens** in Keel's own look, with the honesty checkbox on Create account | Cognito managed login owns credentials, sign-up and reset (ADR-002). The app never renders a password field. | Treat the three auth screens as the **brief for Cognito managed-login branding**: logo, violet accent, Geist, the copy. The honesty checkbox can't live on Cognito's form; move that line to onboarding step 1 as a sentence, or drop it. | No |
| G2 | **Notes on objectives**: append-only list, each dated, 120 chars, can't be edited or deleted | No notes endpoint for objectives. | Add `GET/POST /objectives/{id}/notes` (append-only, no PATCH or DELETE). | Yes, for notes |
| G3 | **Notes on parked ideas**: the same append-only list, including on dropped ideas | One `note` per verdict row. | Add `POST /parked-ideas/{id}/notes` (append-only), or decide notes are verdict notes only and drop the list. | Yes, for notes |
| G4 | **Approved** verdict: an idea moves Parked → Approved; only approved ideas can be picked in New objective; picking one makes it Taken | Verdicts are `parked`, `dropped` (`taken` is written by creating an objective with `from_parked_idea_id`). No `approved`. | Add `approved` to the verdict enum, and have `POST /objectives` refuse a `from_parked_idea_id` that isn't approved. | Yes, for Parking lot |
| G5 | **Drifted deviations have no reasoning.** Chosen → "Your reasoning" (required). Drifted → a pattern instead. | `DeviationWrite.reasoning` is required for both kinds. | Make `reasoning` required only when `kind = chosen`. | Yes, for Log a deviation |
| G6 | **"Did last week's change work?"** has four answers: Worked · Partly · Didn't work · Didn't try it | `improvement_answer`: `yes`, `partly`, `no`. | Add `not_tried`. "Didn't try it" is a different finding from "didn't work" and the next review should be able to tell them apart. | No (can ship with three) |
| G7 | **Reflect** has three fields: *What worked* · *What got in the way* · *What changes next week* (the one quoted back next review) | `what_went_right`, `what_needs_improvement`, `review_summary`; `previous_improvement_note` is quoted back. | Map *What worked* → `what_went_right`, *What changes next week* → `what_needs_improvement` (so it is what gets quoted), and add `what_got_in_the_way`. Using `review_summary` for it would work but misnames the field. | Yes, for reviews |
| G8 | **Over plan**: a planned day can be logged above target ("✓ Met · +30m over"); weeks and totals show "+1h 30m over plan" | `figures` caps a day at its target and returns no over-target minutes. Day states have no over-target state (correctly: it's still `target_met`). | Add `over_target_minutes` to `figures` (same pass, same rule) so every screen gets the same number. Adherence stays capped. | No (the bars can derive it from `minutes_per_day`) |
| G9 | **Final review outcomes** are *Complete it* or *Extend it* only | `outcome` allows `continued`, `completed`, `paused`, `ended`. | Keep the contract. The design deliberately offers two; send `completed`, or `continued` followed by `POST /objectives/{id}/extensions`. | No |
| G10 | **Save draft** button with "Draft saved · 5 Sep, 18:40" | `PATCH /reviews/{id}` is described as autosave. | Do both: autosave on change, keep the button as an explicit save, show the last-saved time. | No |
| G11 | **Onboarding** shows once, after an account is created | No user flag for "has onboarded". | Show it on the first sign-in callback when the user has **zero objectives** and hasn't skipped; remember a skip in a cookie. No contract change needed until it must follow the user across devices. | No |
| G12 | **Pause** needs a reason ("Why are you pausing?") | `reason` is optional on status changes. | The UI requires it; the contract may stay optional. Same for Terminate (`end`). | No |
| G13 | **Undo** in the toast after Approve and Drop | Verdicts are append-only, and Dropped is final (decided in I-03). Nothing can be taken back once sent. | The UI holds the verdict request until the toast closes; Undo cancels it before it is sent. No backend change. *(Decided in I-03.)* | No |
| G14 | **So far** on the Overview ("of 24h 00m planned", "8 of 12 planned days") and the list's "80% · On track" | `figures` covers the whole run, and its target includes days not yet reached (`adherence.md`, decision 2). At day 14 of 30, a perfect record reads about 47%. | Return a second set of figures over the plan so far, from the same rule. *(Found in I-03 planning.)* | Yes, for Overview and the list |
| G15 | **On track · At risk · Behind** on the list pill | No rule defines the bands. | One domain rule over the so-far adherence, returned by the server so the list and the Overview agree. *(Found in I-03 planning.)* | Yes, for the list |
| G16 | **Figures per plan week**: the Effort tab's *By week* table (planned, logged, days met, over plan, extra), the final review's adherence row per week, and the monthly review's week rows | No per-week figures. `EffortMonth` weeks start on Monday and stop at month edges; the design's weeks are plan weeks. | Return per-week figures from the same rule. Computing them in the client would break "one rule, one implementation", worst for flexible weeks. *(Found in I-03 planning.)* | Yes, for Effort and reviews |
| G17 | **Weeks met** on a flexible objective: "1 of 2 full weeks at target", "no full week yet" | `figures` counts days, never weeks. | Add a week count, met and planned, to `figures`. *(Found in I-03 planning.)* | Yes, for flexible objectives |
| G18 | **Entries with their times** on the Effort tab: the last day logged, and each day in the Week dialog ("09:20 – 10:20 · note · 1h") | `EffortMonth` rows carry no start time. `GET /day/{date}` does, but a week would take seven calls. | Read an objective's entries over a date range in one call, and return the last date logged on the objective. *(Found in I-03 planning.)* | Yes, for Effort |
| G19 | **One card per due review** on the Reviews tab ("Week 3 review · Opens after Week 1"), and a saved review's "Week 3 · not saved yet" | `GET /objectives/{id}/reviews` returns only reviews that exist. A due window nobody has started has no label or period. | Return the due windows with the reviews. *(Found in I-03 planning.)* | Yes, for the Reviews tab |
| G20 | **The change a saved review set**, under each saved row ("Change: 'Do the hardest problem first…'") | `ReviewSummary` has `review_summary`, not `what_changes_next`. | Add `what_changes_next` to `ReviewSummary`. *(Found in I-03 planning.)* | No (one call per review otherwise) |
| G21 | **"As they were when saved"** on a saved review | Figures are recomputed whenever a review is read (invariant 14, ADR-008), and an effort entry can be edited or deleted on any later day. | Keep recomputing, and reword the UI. Narrow what can change instead: an entry can be edited or deleted only on its own day. *(Found in I-03 planning.)* | No |
| G22 | **Final review covers the whole plan**: "The plan in numbers · All 26 days" | A `plan_end` review's figures cover its last period only (`review-windows.md`). | A plan-end review's figures and `adherence_pct` cover the whole plan up to its period end. Deviations and the last change stay on the last period. *(Found in I-03 planning.)* | Yes, for the final review |
| G23 | **"Terminated · Ended 5 Sep"** and **"Paused since 5 Sep"** on the list | `ObjectiveSummary` has no status date. | Add the date of the latest status change to `ObjectiveSummary`. *(Found in I-03 planning.)* | No (one call per objective otherwise) |
| G24 | **A flexible card on Today**: "15h 00m / 20h this week", "Leaves 5h 00m for the week", "1 day left" | The contract declares `DayObjective.period_logged_minutes`, but `assembleDay` never returns it, which is a bug. Nothing returns the days worked so far in the slot's week. | Return `period_logged_minutes` and the days worked in the slot's week. *(Found in I-03 planning.)* | Yes, for flexible objectives on Today |
| G25 | **Plan to date** on Today's rail: each objective's percentage with On track · At risk · Behind | `DayObjective` carries no figures. | Carry the G14 adherence so far and the G15 band on each `DayObjective`, so Today stays one call (NFR-03). *(Found in I-03 planning.)* | Yes, for the rail |
| G26 | **"Not started"** and **"Day 1"** on Today | `DayObjective` has no start date, so an objective that starts later can't be told apart from one with nothing planned today. | Add `start_date` to `DayObjective`. *(Found in I-03 planning.)* | Yes, for those two states |
| G27 | **The summary ring**: "% of today's planned time", "1h 20m to go of 6h planned" | No total of today's planned time, and no rule for what a flexible objective plans on a given day. | Only fixed day slots plan time for a day. Return today's planned and to-go minutes. *(Found in I-03 planning.)* | Yes, for the summary |
| G28 | **Extra, off days** next to **This week** in the summary | `totals.extra_off_day_minutes` covers today only, while `week_minutes` covers the week. | Cover the same week as `week_minutes`. *(Found in I-03 planning.)* | No |
| G29 | **"Overlaps 09:20–10:20 … Change the times."** in Log time | The server checks no overlap, and `occurred_at_local` is optional. | Refuse an overlapping entry on the server, and require a start time. *(Found in I-03 planning.)* | No (the UI can check, but a second tab could still overlap) |
| G30 | **The user's name**: the avatar initial, "Signed in as {name}", "Welcome, {name}" | The `user` table stores no name, and no endpoint returns the signed-in user. | Take the name from Cognito at sign-in, and return the user from `GET /session`. *(Found in I-03 planning.)* | Yes, for the shell and onboarding |
| G31 | **The date of an idea's verdict**: "Approved 22 Sep", "Taken 31 Aug", "Dropped 21 Sep", and "Caught 31 Aug · approved 22 Sep" in New objective | `ParkedIdea` has no date for its current verdict. | Return the current verdict's date. *(Found in I-03 planning.)* | Yes, for the Parking lot pills |
| G32 | **"3rd time"** on a drifted deviation, counted across all time | Only the pattern's total count exists (`occurrences`), which is wrong for any deviation but the latest. | Return each deviation's place in its pattern's history. *(Found in I-03 planning.)* | Yes, for the deviation detail |
| G33 | **"At the 21 Sep review you'll mark whether the reasoning held"** | Nothing says which review will judge a deviation. Working it out in the client would duplicate the review-windows rule. | Return the date of the review that will judge it. *(Found in I-03 planning.)* | Yes, for the deviation detail |
| G34 | **"First review Fri 11 Sep"** in onboarding, and **"The first one is due Sat 29 Aug"** on the Reviews tab | `next_review_on` is set only once a review is due. | Return the end of the next window not yet saved, due or not. *(Found in I-03 planning.)* | Yes, for those two lines |
| G35 | **Seed patterns for a new account**: New path looks better · Planning instead of doing · Research spiral, each with a one-line description | Nothing creates them. | Create them with the user. The descriptions are the prototype's. *(Found in I-03 planning.)* | No |
| G36 | **A new pattern named in Log a deviation** "joins your pattern list when you record this deviation" | A pattern and a deviation are two calls. If the second fails, the pattern stays anyway. | Keep it. On retry the user picks the pattern from the list, and nothing is lost. *(Found in I-03 planning.)* | No |
| G37 | **"Taken 31 Aug · Runs 1 Sep – 2 Nov"**: an idea is taken the day the objective is created | The `taken` verdict is dated by the objective's `starts_on`. | Date it by the day it was created, in the request's zone. *(Found in I-03 planning.)* | No |
| G38 | **"Locked until 2 Nov"** in Park an idea, before the idea is saved | The lock date exists only after parking. | Return the lock a new idea would get, from the same rule. *(Found in I-03 planning.)* | Yes, for the dialog's lock note |
| G39 | **New objective's preview**: the number of reviews, and "The last one, on Sat 3 Oct" | Review windows are a domain rule (`review-windows.md`), with month-end clamping. | The UI imports the same pure `reviewWindows` the server uses. No endpoint. *(Found in I-03 planning.)* | No |

## Decided in I-03

The table above is the gap as the design found it. This is how each was closed
(`docs/intents/I-03-backend-for-keel-modern/`).

| # | Decision |
|---|---|
| G1 | Out of I-03 — branding Cognito's managed login is not backend work. |
| G2 | `POST /objectives/{objectiveId}/notes`; notes return inside the objective. Append-only, open in every state. |
| G3 | `POST /parked-ideas/{ideaId}/notes`; notes return on every idea. A note is separate from the drop reason, which stays on the `dropped` verdict and is now required. |
| G4 | `approved` verdict; only an approved idea can be taken. **Also changed:** the lock no longer refuses any decision — approving, dropping or taking early is recorded as early (`decided_early`) — and dropped and taken are final. |
| G5 | `reasoning` required only for a `chosen` deviation (`422` otherwise). |
| G6 | `improvement_answer` gains `not_tried`. |
| G7 | Fields renamed for what they hold: `what_worked`, `what_got_in_the_way`, `what_changes_next` (quoted back as `previous_what_changes_next`). `review_summary` stays. |
| G8 | `figures.over_target_minutes`; adherence stays capped (`docs/domain/adherence.md`, rule 7). |
| G9 | Kept: the UI sends `completed`, or `continued` then an extension. |
| G10 | `last_saved_at` on the review and in the reviews list. Autosave and the Save draft button both write the draft. |
| G11 | Kept: no backend change. |
| G12 | Kept: the UI requires the reason; the contract leaves it optional. |
| G13 | Kept: the UI holds a verdict until its toast closes. |
| G14 | `figures_to_date` on `ObjectiveSummary`: the same `figures` rule over the slots that have ended, plus today's day slot. A flexible week counts once it has ended, so a week in progress never lowers the score. |
| G15 | `track` on `ObjectiveSummary`: `on_track` at 80% so-far adherence or more, `at_risk` from 60 to 79%, `behind` below 60%. Null until a slot has ended. One domain rule. |
| G16 | `weeks` on `Objective`: one entry per plan week (tiled from each segment's start, as flexible weeks and weekly windows are), each with its dates and its `figures`. |
| G17 | `figures.planned_weeks` and `figures.target_met_weeks`, for flexible objectives: week slots, and those whose credited minutes reach the week's target. |
| G18 | `GET /objectives/{objectiveId}/effort-entries?from=&to=` returns the entries in the range, with their times. `last_logged_on` on `Objective`. |
| G19 | `GET /objectives/{objectiveId}/reviews` also returns `due`: every due window, oldest first, with its label, kind, period, and the draft's id when one exists. |
| G20 | `what_changes_next` on `ReviewSummary`. |
| G21 | Kept: figures are recomputed. The UI reads "Recomputed from the record", not "As they were when saved". **Also changed:** an effort entry is logged only for today, in the request's zone, and can be edited or deleted only on its own day, in the zone it was logged in (`422` otherwise). A day's effort is then fixed once the day is over, so a saved review's figures move only if a rule changes. |
| G22 | A `plan_end` review's figures and `adherence_pct` cover the whole plan up to its period end. Its deviations and its last change stay on the last period. |
| G23 | `status_since` on `ObjectiveSummary`: the date of the latest status event. |
| G24 | `period_logged_minutes` is returned as the contract already declares it. `period_days_worked` on `DayObjective` for a week slot: the days in the slot's week, up to and including this date, with any effort. |
| G25 | `adherence_to_date` and `track` on `DayObjective`, from the G14 and G15 rules. |
| G26 | `start_date` on `DayObjective`. |
| G27 | `totals.today_planned_minutes`: the targets of today's fixed day slots. A flexible objective plans no particular day. `totals.today_to_go_minutes`: for each of those slots, what is still unlogged, never below zero. |
| G28 | `totals.extra_off_day_minutes` covers the same Monday-to-Sunday week as `week_minutes`. |
| G29 | `occurred_at_local` is required. An entry whose start-to-end overlaps another of the user's entries on that day, under any objective, is refused with `422`, on create and on edit. |
| G30 | Out of I-03 — waits for the sign-in and sign-up screens to be final (`docs/intents/TRIAGE.md`). |
| G31 | `verdict_on` on `ParkedIdea`: the current verdict's `occurred_on`. |
| G32 | `pattern_nth` on `Deviation`: its place among the deviations naming the same pattern, by date, then as recorded. Null without a pattern. |
| G33 | `review_due_on` on `Deviation`: the earliest `period_end` among the review windows covering its date, across the objectives it names. |
| G34 | `upcoming_review_on` on `ObjectiveSummary`: the end of the earliest window without a saved review, due or not. Null once none is left. `next_review_on` keeps its meaning. |
| G35 | Kept: a new account starts with no patterns. The design's three are examples, not seed data. |
| G36 | Kept: two calls. |
| G37 | The `taken` verdict is dated today in `ObjectiveWrite.tz`, not `starts_on`. `decided_early` compares that day with `locked_until`. |
| G38 | `GET /parked-ideas?caught_on=YYYY-MM-DD` also returns `new_idea_locked_until`, by `lockedUntil`. |
| G39 | Kept: no backend change. `reviewWindows` stays pure so the UI can import it. |

## Names that differ (not gaps — map them in the UI)

| Design says | Contract value |
|---|---|
| Terminated | objective status `ended`, status change `end` |
| Met · Short · Missed · Off day · + Extra | day states `target_met` · `worked_short` · `planned_no_log` · `off_day` · `off_day_worked` |
| It held · It didn't hold | deviation verdict `worth_it` · `not_worth_it` |
| Weekly · Monthly · Final review | review kind `weekly` · `monthly` · `plan_end` |
| Fixed · Flexible | schedule mode `fixed` · `flexible` |
| Met · Partly met · Not met | `criteria_verdict` `met` · `partly_met` · `not_met` |
| Extend by *n* weeks / months | `extend_by_days`: weeks × 7; months = days to the same date *n* months on, minus one |
| An entry's start and end time | `occurred_at_local` (start) and `minutes` (end − start). The dialog collects start and end and sends both derived values. |

## Limits the design uses (stricter than the contract)

| Field | Design | Contract |
|---|---|---|
| Effort entry note | 120 | 2000 |
| Deviation *What happened* | 120 | 2000 |
| Deviation reasoning | 280 | 2000 |
| Pattern name / description | 40 / 120 | — |
| Idea / Why it grabbed you | 120 / 280 | — |
| Objective name | 80 | — |
| Why it matters · Success criteria | 280 each | — |
| Review answers | 280 each | 4000 |
| Notes | 120 | — |
| Pause / terminate reason | 280 | 2000 |

Short limits are part of the design: the point is a line someone will read back, not an essay. Enforce them in the UI and keep the contract's larger limits as the outer bound.
