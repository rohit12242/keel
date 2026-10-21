# Plan — I-03 · Fit the backend to the Keel Modern design

**Intent:** `intent.md` · **Spec:** `spec.md` (revision 2, Accepted 2026-10-21) · **Status:** ACCEPTED 2026-10-21 · **Written:** 2026-10-20 · **Revised:** 2026-10-21

## What is already built, and what is not

Read from the code on `i-03-backend-for-keel-modern`, against the contract, ERD
revision 5 and `docs/domain/` as this branch already changed them:

- **Before step 0.** Spec revision 2 is accepted, and in the same commit the
    contract, ERD invariant 18 and `docs/domain/` (adherence: weeks, over a window,
    so far, track, plan weeks; review windows: due list, next review, the review
    that judges a deviation, plan-end figures; parking lock: lock preview, take
    date) take G14–G39 as `contract-gaps.md` decides them. Steps 10–18 build against
    that contract, just as steps 1–9 build against the one this branch already
    changed. No step edits a design document.
- **The code still enforces rules this branch reversed:**
  - *The lock refuses a verdict.* `verdictRefusal` returns `"locked"`
    (`parking/domain/parking.ts`). The service passes it on, and the verdicts route
    turns it into a 422 `idea-locked`.
  - *A dropped idea can be revived.* No rule stops a `parked` row after a `dropped`
    one. `canTake` takes any idea whose current verdict is `parked`, with no approval
    step. `validateVerdictWrite` accepts only `parked | dropped`.
  - *`taken_early`.* It is computed in `assembleIdea` and asserted in `parking.test`,
    `park.itest` and `take.itest`.
  - *Reasoning is required on every deviation.* `validateDeviationWrite` makes it a
    400 field error. In the database, `deviation.reasoning` is `NOT NULL`
    (`migrations/1791900000000_deviations.cjs`). `DeviationRow` and the contract
    type both have `reasoning: string`.
  - *The old review names.* `what_went_right`, `what_needs_improvement` and
    `previous_improvement_note` appear in `ReviewRow`/`Review`
    (`assembleReview.ts`), `ReviewEdit`/`RULES` (`reviewWrite.ts`), and
    `REVIEW_COLUMNS`/`EDITABLE` (`reviews/repo.ts`). They are also columns in the
    reviews migration. `improvement_answer` is the enum `yes | partly | no`.
  - *A `taken` verdict is dated by `starts_on`* (`objectives/service.ts`,
    `createObjective`).
  - *Effort can be logged, edited and deleted on any day of the plan.*
    `validateEffortEntryWrite` checks the date's shape only. `validateEffortEdit`
    refuses a changed `local_date` and nothing else. `occurred_at_local` is optional
    and nullable in the database.
- **Missing entirely:** `over_target_minutes`, `last_saved_at`, the `approved`
    verdict, both notes tables and both notes routes,
    `GET /objectives/{id}/effort-entries`, and every new field G14–G38 names.
- **G30 is not in this plan.** The user's name and `GET /session` depend on the
    sign-in and sign-up screens, which are not final. It is in TRIAGE with the rest
    of the authentication work.
- **G35 needs no code.** A new account starts with no patterns, which is what
    `createUser` already does.
- **A bug the spec now names.** The contract declares
    `DayObjective.period_logged_minutes`, but `assembleDay` never returns it. The
    Today query reads only the date's entries and a Monday-week sum, so it has
    nothing to compute a slot's progress or the adherence to date from.
- **Tests replay history through the write path.** `testEntry`
    (`src/test/fixtures.ts`) calls `createEffortEntry` with `2026-09-16`, and
    `story.itest.ts` and `scripts/story-check.mjs` post effort for five days in
    September. G21 refuses all of them, because none of those dates is today.
- **CI on this branch is already red.** The contract declares
    `createObjectiveNote` and `createParkedIdeaNote`, but neither has a handler, so
    `contract-coverage.itest.ts` fails. Once revision 2 is in the contract, the
    entries read is missing too. It goes green at step 14.
- **Reusable as it is:** `figures()` (`effort/domain/adherence.ts`) is the one pass
    every figure comes from. `windowFigures` (`reviews/domain/assembleReview.ts`)
    already does figures over a range of days without losing extra minutes.
    `reviewSchedule`, `dueWindows` and `periodKey` (`reviewWindows.ts`) give every
    window and its label. `lockedUntil` gives a lock without an idea. `mondayOf`
    (`effort/domain/effortMonth.ts`) is the Monday week. `coveringSlot`,
    `planSlots`, `lockIdea`/`insertVerdict`, `OBJECTIVES_SQL`, `IDEA_COLUMNS`,
    `DEVIATION_COLUMNS` and its one presenter `present()`, `withTransaction`,
    `localDayOf`, `isIsoDate`, `problem`, `notFound` and `withSession` are reusable
    too.
- **Postgres 18**, locally and on RDS. `ALTER TYPE … ADD VALUE` runs inside
    node-pg-migrate's transaction, provided the new value is not used in the same
    migration.

## Migrations — schema only, no backfill

There is no real data, so no migration backfills a row or keeps old rows working.
Each constraint is added in its validating form. If a database holds a row that the
new rule forbids, the migration fails, and that failure is how we find out the
no-data premise was wrong. One migration per step that changes the schema,
timestamped after `1791900200000`.

| Step | Change | How |
|---|---|---|
| 2 | `review.what_went_right`, `what_needs_improvement` → `what_worked`, `what_got_in_the_way`, `what_changes_next` | Drop both columns and add the three, each `text CHECK (char_length(…) <= 4000)`. They are dropped and added rather than renamed because an inline CHECK keeps its auto-generated name, so a rename would leave `review_what_went_right_check` guarding `what_worked`. Down reverses it. |
| 3 | `improvement_answer` gains `not_tried` | `ALTER TYPE improvement_answer ADD VALUE 'not_tried'`. Down recreates the type without it: rename the old type, create the new one, `ALTER COLUMN … TYPE … USING improvement_answer::text::improvement_answer`, then drop the old type. Down fails if any row holds `not_tried`, which is correct. |
| 4 | `review.last_saved_at` | `ADD COLUMN last_saved_at timestamptz` (nullable). Down drops it. |
| 5 | `deviation.reasoning` nullable on drifted | `ALTER COLUMN reasoning DROP NOT NULL`. Then `ADD CONSTRAINT deviation_reasoning_only_chosen CHECK ((kind = 'chosen') = (reasoning IS NOT NULL))`. The existing length CHECK stays, since a null passes it. Down drops the constraint and sets `NOT NULL` again. |
| 6 | `parked_verdict` gains `approved`; dropped and taken are final; dropping says why | `ALTER TYPE parked_verdict ADD VALUE 'approved' BEFORE 'taken'`. Drop `parked_idea_verdict_one_taken_idx` and add `parked_idea_verdict_one_final_idx`, which is `UNIQUE (parked_idea_id) WHERE verdict IN ('taken','dropped')`, so an idea has at most one final row. Add `parked_idea_verdict_dropped_says_why`, which is `CHECK (verdict <> 'dropped' OR char_length(note) >= 1)`. "Nothing follows a final row" and "`taken` follows only `approved`" are enforced by the service under `lockIdea`, the same split as today. Down reverses it, recreating the type as in step 3. |
| 8 | `objective_note` | `CREATE TABLE objective_note (id uuid PK, objective_id uuid NOT NULL REFERENCES objective(id), written_on date NOT NULL, text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000), recorded_at timestamptz NOT NULL DEFAULT now())`. Index on `(objective_id, written_on, recorded_at)`. No `user_id`: ownership travels through the objective, as the ERD says. |
| 9 | `parked_idea_note` | The same shape on `parked_idea(id)`. |
| 12 | `effort_entry.occurred_at_local` required | `ALTER COLUMN occurred_at_local SET NOT NULL`. Down drops `NOT NULL`. No overlap constraint: `effort_entry` has no `user_id` (ERD invariant 1), so an exclusion constraint cannot see the user's other objectives. The service enforces it under a lock (step 12). |

## Files that change

| Step | File | Change |
|---|---|---|
| 0 | `docs/intents/I-03-backend-for-keel-modern/plan.md` | This file, `Status: ACCEPTED <date>`, committed alone |
| 1 | `src/modules/effort/domain/adherence.ts` | `over_target_minutes`: per slot, `inSlot − min(inSlot, target)`, from the same loop as credited. `planned_weeks` and `target_met_weeks`: week slots, and those whose `inSlot` reaches `targetMinutes` (G17). Both are 0 on a fixed objective |
| 1 | `src/shared/contract.ts` | `Figures` gains the three fields |
| 1 | `src/modules/effort/domain/adherence.test.ts` | Every `toEqual` gains the three fields. A new test checks the sum (see Proof), and one checks weeks met on the flexible worked example |
| 1 | `src/modules/reviews/domain/assembleReview.test.ts`, `src/modules/objectives/domain/assembleObjective.test.ts` | Exact `figures` objects gain the three fields |
| 1 | `docs/intents/TRIAGE.md` | `windowFigures` loses minutes where a flexible week straddles a monthly window (see Proof) |
| 2 | `migrations/<ts>_review-reflections.cjs` *(new)* | As in the table above |
| 2 | `src/modules/reviews/domain/assembleReview.ts`, `reviewWrite.ts`, `src/modules/reviews/repo.ts` | Rename in `ReviewRow`, `Review`, `ReviewEdit`, `RULES`, `REVIEW_COLUMNS` and `EDITABLE`. `previous_improvement_note` becomes `previous_what_changes_next`, read from `previous.what_changes_next` |
| 2 | `reviewWrite.test.ts`, `assembleReview.test.ts`, `saveReview.test.ts`, `deviationVerdict.test.ts`, `edit-review.itest.ts`, `src/story.itest.ts`, `scripts/story-check.mjs` | Names only |
| 3 | `migrations/<ts>_improvement-not-tried.cjs` *(new)*; `reviewWrite.ts` | `RULES.improvement_answer` gains `not_tried`; the `ReviewRow` type gains it too |
| 3 | `reviewWrite.test.ts`, `edit-review.itest.ts` | `not_tried` is accepted and round-trips |
| 4 | `migrations/<ts>_review-last-saved-at.cjs` *(new)* | |
| 4 | `reviews/repo.ts` | `REVIEW_COLUMNS` reads `last_saved_at` in UTC, formatted like `saved_at`. `updateReviewAnswers` always sets `last_saved_at = now()`, even when the body names no field |
| 4 | `assembleReview.ts` | `last_saved_at` on `ReviewRow` and `ReviewSummary`, so it appears both on the review and in the list |
| 4 | `assembleReview.test.ts`, `saveReview.test.ts`, `deviationVerdict.test.ts`, `edit-review.itest.ts` | `ReviewRow` literals gain `last_saved_at: null`. The itest checks the timestamps |
| 5 | `migrations/<ts>_drifted-without-reasoning.cjs` *(new)* | |
| 5 | `src/modules/deviations/domain/deviationWrite.ts` | `reasoning` is no longer a required field. On a drifted deviation it is ignored and stored as null. `deviationRefusal` refuses a chosen deviation without reasoning, which reaches the client as the contract's 422 |
| 5 | `src/modules/deviations/repo.ts`, `service.ts` (`present`), `src/shared/contract.ts` | `reasoning: string \| null` on the row. `present` leaves it out when null, as it already does for `did_instead`, because the contract types it as a non-null string. The contract type becomes `reasoning?: string` |
| 5 | `deviationWrite.test.ts`, `deviations.itest.ts`, `deviation-schema.itest.ts` | See Proof |
| 6 | `migrations/<ts>_parking-approved-and-final.cjs` *(new)* | |
| 6 | `src/modules/parking/domain/parking.ts` | `VerdictWrite` accepts `parked \| approved \| dropped`. `VerdictRow` gains `approved` and `IdeaRow`/`ParkedIdea` follow. `assembleIdea`: the current verdict is the final row if there is one, otherwise the latest row. `decided_early` replaces `taken_early` and is true when the current verdict's `occurred_on` is before `locked_until` and the current verdict is not `parked`. `verdictRefusal(row, write, today)` returns `final` (409), `needs_reason` (dropped with no note, 422), `future` (`occurred_on` after today, 422) or null. It never returns `locked` |
| 6 | `src/modules/parking/service.ts`, `src/app/v1/parked-ideas/[ideaId]/verdicts/route.ts` | `locked` is removed and `taken` becomes `final`. The responses are 409 *This idea's verdict is final* and 422 for the two rules. The `idea-locked` problem type goes |
| 6 | `parking.test.ts`, `verdicts.itest.ts`, `parking-schema.itest.ts`, `park.itest.ts`, `take.itest.ts`, `src/test/authorization-table.ts` | See Proof |
| 7 | `parking.ts` (`canTake`), `src/modules/objectives/service.ts` | Only a current `approved` verdict can be taken. The refusal reads "The idea is not approved: it is parked, dropped or already taken." The `taken` verdict is dated `localDayOf(now, write.tz)`, not `starts_on` (G37), so `createObjective` takes `now`, and so does its route |
| 7 | `src/app/v1/objectives/route.ts`; `parking.test.ts`, `take.itest.ts` | See Proof |
| 8 | `migrations/<ts>_objective-note.cjs` *(new)* | |
| 8 | `src/modules/objectives/domain/noteWrite.ts` *(new, + test)* | Pure `validateNoteWrite` (400: `written_on` date, `text` 1–2000) and `noteRefusal(written_on, today)` (422 when it is in the future). Parking imports it in step 9, just as it already imports from `objectives/domain` |
| 8 | `objectives/domain/rows.ts`, `assembleObjective.ts`, `repo.ts`, `service.ts` | A `notes` CTE in `OBJECTIVES_SQL`, oldest first by `written_on` then `recorded_at`. `insertObjectiveNote`, written as an `INSERT … SELECT … WHERE` that the objective is the caller's, returns no row for anyone else's objective, which becomes a 404. `createObjectiveNote` reads the caller's zone for "today". `Objective.notes` |
| 8 | `src/app/v1/objectives/[objectiveId]/notes/route.ts` *(new)*; `contract.ts` (`Note`, `Objective.notes`) | |
| 8 | `src/test/authorization-table.ts`; `src/modules/objectives/objective-notes.itest.ts` *(new)*; `objectives-one-read.itest.ts` | Authorisation row; the declared responses; still one query |
| 8 | `assembleObjective.test.ts`, `scheduleGrid.test.ts`, `validateExtension.test.ts`, `committedMinutes.test.ts` | `ObjectiveRow` literals gain `notes: []` (typecheck forces this) |
| 9 | `migrations/<ts>_parked-idea-note.cjs` *(new)* | |
| 9 | `parking/repo.ts` (`IDEA_COLUMNS`, `insertIdeaNote`), `parking/domain/parking.ts`, `parking/service.ts` | Notes on every idea, in the same correlated `json_agg` pattern as verdicts. `createParkedIdeaNote` |
| 9 | `src/app/v1/parked-ideas/[ideaId]/notes/route.ts` *(new)*; `authorization-table.ts`; `src/modules/parking/idea-notes.itest.ts` *(new)*; `park.itest.ts` | |
| 9 | `parking.test.ts`, `assembleReview.test.ts` | `IdeaRow` literals gain `notes: []` |
| 10 | `parking/domain/parking.ts` (`assembleIdea`) | `verdict_on`: the current verdict's `occurred_on` (G31) |
| 10 | `parking/service.ts` (`listParkedIdeas`), `src/app/v1/parked-ideas/route.ts` | `caught_on` query parameter: `isIsoDate` or 400. When present, `getLockFacts` and `lockedUntil` give `new_idea_locked_until` (G38). That is a second fixed query, only when the parameter is sent. Absent, the field is absent |
| 10 | `parking.test.ts`, `park.itest.ts`, `contract.ts` | `verdict_on` per verdict. The list with `caught_on` returns the same lock that parking the idea then stores; a malformed `caught_on` is 400 |
| 11 | `src/modules/deviations/repo.ts` (`DEVIATION_COLUMNS`, `DeviationRow`) | `pattern_nth`: a correlated count of the user's deviations naming the same pattern, ordered by `(local_date, recorded_at)` up to this one; null without a pattern (G32). `review_objectives`: for each named objective, its `review_cadence` and its segments' ids and dates |
| 11 | `src/modules/reviews/domain/reviewWindows.ts` | Pure `reviewDueOn(date, objectives)`: the earliest `period_end` among the windows of `reviewSchedule` that contain `date`, across the objectives (G33). Null when no window covers it |
| 11 | `deviations/service.ts` (`present`), `contract.ts` | `pattern_nth` and `review_due_on` on `Deviation`. `present` is the one presenter, so Today's last deviation, the list, the create response and a review's deviations all gain both |
| 11 | `reviewWindows.test.ts`, `deviations.itest.ts` | See Proof |
| 12 | `migrations/<ts>_effort-start-required.cjs` *(new)* | |
| 12 | `src/modules/effort/domain/validateWrite.ts`, `validateEffortEdit.ts` | `occurred_at_local` is required on create, and `HH:MM` within `00:00`–`23:59` on both. Pure `overlaps(entry, others)`: `[start, start + minutes)` in minutes from midnight against each other entry, with no wrap past midnight |
| 12 | `src/modules/effort/repo.ts`, `service.ts` | Create and edit run in one transaction that locks the user's row (`SELECT … FROM "user" WHERE id = $1 FOR UPDATE`), reads the user's entries on that `local_date` across every objective, refuses an overlap with 422 `entry-overlaps` naming the entry it hits, and only then writes. An edit leaves itself out of the comparison |
| 12 | `src/test/fixtures.ts` (`testEntry`) | Inserts through `effort/repo.ts` directly, with `occurred_at_local` defaulting to `09:00`, so a fixture can seed any date and any number of entries. The write rules are tested in `create-effort.itest` and `edit-effort.itest`, not through the fixture |
| 12 | `validateWrite.test.ts`, `validateEffortEdit.test.ts`, `create-effort.itest.ts`, `edit-effort.itest.ts`, `date-storage.itest.ts`, `authorization-table.ts`, `src/story.itest.ts`, `scripts/story-check.mjs` | Every posted entry sends `occurred_at_local`, at times that do not overlap. See Proof |
| 13 | `src/modules/effort/domain/effortDay.ts` *(new, + test)* | Pure `effortDayRefusal(localDate, today)`: `not_today` when they differ (G21) |
| 13 | `effort/service.ts`, `src/app/v1/objectives/[objectiveId]/effort-entries/route.ts`, `src/app/v1/effort-entries/[entryId]/route.ts` | Create compares `local_date` with `localDayOf(now, tz)` from the body. Edit and delete compare the entry's `local_date` with `localDayOf(now, entry.tz)`. A mismatch is 422 `not-today`, after the 404. The services take `now`, from the routes |
| 13 | `create-effort.itest.ts`, `edit-effort.itest.ts`, `authorization-table.ts`, `src/story.itest.ts`, `scripts/story-check.mjs` | Entries posted through a route are dated today in their zone, on objectives whose plan covers today. History comes from `testEntry` in itests. `story-check.mjs`, which has no database, starts its objective four weeks ago and logs only today. See Risks |
| 14 | `effort/repo.ts`, `service.ts`, `src/app/v1/objectives/[objectiveId]/effort-entries/route.ts` (GET) | `listObjectiveEntries(userId, objectiveId, from, to)`: both dates required and `to ≥ from`, else 400; 404 for anyone else's objective. One query: the objective's segments and status events, and its entries in the range, by `local_date`, `occurred_at_local`, `logged_at`. Each entry's `extra` from `coveringSlot`, as `GET /day` does (G18) |
| 14 | `objectives/domain/assembleObjective.ts` | `last_logged_on`: the last date in `daily_minutes`, which `OBJECTIVES_SQL` already reads. No SQL change |
| 14 | `contract.ts`; `src/modules/effort/list-entries.itest.ts` *(new)*; `authorization-table.ts`; `assembleObjective.test.ts` | See Proof. `contract-coverage.itest.ts` passes again |
| 15 | `effort/domain/adherence.ts` | `windowFigures` moves here from `assembleReview.ts`, unchanged, because three modules now call it. New `slotsToDate(slots, today)`: the slots that ended before today, plus today's day slot. New `figuresToDate(slots, daily, today)`: `figures` over those slots and the minutes on their days, plus extra on uncovered days up to today. The days of a week still in progress count in neither (G14) |
| 15 | `effort/domain/track.ts` *(new, + test)* | Pure `trackOf(figuresToDate, anyEnded)`: `on_track` ≥ 80, `at_risk` 60–79, `behind` < 60, null when no slot has ended (G15) |
| 15 | `reviews/domain/reviewWindows.ts` | Pure `upcomingReviewOn(...)`: the `period_end` of the earliest window without a saved review, leaving out windows that ended with no planned day. Null unless the objective is active or paused (G34) |
| 15 | `objectives/domain/assembleObjective.ts` (`summaryOf`), `contract.ts`; `assembleObjective.test.ts`, `objectives.itest.ts` | `figures_to_date`, `track`, `status_since` (the latest status event's date, G23) and `upcoming_review_on` on `ObjectiveSummary`. `reviews/domain/assembleReview.ts` imports `windowFigures` from its new home |
| 16 | `objectives/domain/planWeeks.ts` *(new, + test)* | Pure `planWeeks(segments)`: 7-day weeks tiled from each segment's start, the last clipped to the segment's end. Each week's `figures` from `windowFigures` (G16) |
| 16 | `assembleObjective.ts`, `contract.ts`; `assembleObjective.test.ts`, `objectives.itest.ts` | `Objective.weeks`. Only the detail carries it, not the list |
| 17 | `src/modules/today/repo.ts`, `domain/rows.ts` | A `daily_minutes` CTE in `DAY_SQL`, the same shape as `OBJECTIVES_SQL`'s: each objective's minutes per date, all dates up to `$2`. The `wk` CTE goes, because `week_minutes` is now summed from those rows. Still one query |
| 17 | `src/modules/today/domain/assembleDay.ts`, `contract.ts` | On `DayObjective`: `period_logged_minutes` (a week slot's minutes up to the date, the bug, G24), `period_days_worked` (days of that week up to the date with any effort, G24), `adherence_to_date` and `track` (G25), `start_date` (G26). On `totals`: `today_planned_minutes` and `today_to_go_minutes` from today's fixed day slots (G27). `extra_off_day_minutes` covers `mondayOf(date)` to Sunday (G28) |
| 17 | `assembleDay.test.ts`, `computed-slot.itest.ts`, `last-deviation.itest.ts` | `DayObjectiveRow` literals gain `daily_minutes` and lose `week_minutes`. See Proof |
| 18 | `reviews/domain/assembleReview.ts` | `figuresWindow(review, schedule)`: a `plan_end` review's figures and `adherence_pct` run from the first window's `period_start` to its `period_end`. Deviations, `minutes_per_day` and the quoted change stay on its own period (G22). `what_changes_next` on `ReviewSummary` (G20) |
| 18 | `reviews/service.ts` (`listReviews`), `src/app/v1/objectives/[objectiveId]/reviews/route.ts` | `due`: `dueWindows` over the labelled schedule, each with `label`, `kind`, `period_start`, `period_end`, and `review_id` when a draft holds that period (G19) |
| 18 | `assembleReview.test.ts`, `plan-end.itest.ts`, `review-due.itest.ts`, `contract.ts` | See Proof |
| 19 | `src/story.itest.ts`, `scripts/story-check.mjs` | The story walks the new design: approve an idea, add a note to the objective, record a drifted deviation with no reasoning, answer `not_tried`, see `previous_what_changes_next` quoted back, read `over_target_minutes`, `track`, `weeks` and the entries of a week |

## Order of work

Each step is one commit, footer `Intent: I-03`. Every step is built and tested
locally; the integration tests run in CI. About 7–8 days in all.

0. **The accepted plan**, committed alone.
1. **Over plan and weeks met (G8, G17).** Both are new fields of `figures()`, so
   the exact-object tests change once. Pure and schema-free, so it goes first; its
   tests also prove the sum the later steps rely on.
2. **Review reflections renamed (G7).** This is the widest rename, so it is done
   before the two small review changes that build on the new names.
3. **`not_tried` (G6).**
4. **`last_saved_at` (G10).**
5. **A drifted deviation needs no reasoning (G5).**
6. **The verdicts (G4, first half).** `approved` exists, the lock records instead of
   refusing, dropped is final and says why, and `decided_early` replaces
   `taken_early`.
7. **Only an approved idea is taken, on the day it is taken (G4 second half,
   G37).** Kept apart from step 6 because it changes a different endpoint,
   `createObjective`, and its failure would show in `take.itest` alone.
8. **Notes on an objective (G2).**
9. **Notes on a parked idea (G3).**
10. **The verdict's date and the lock before parking (G31, G38).**
11. **A deviation's place in its pattern and its review (G32, G33).**
12. **Every entry has a start time, and none overlap (G29).** Also moves
    `testEntry` off the write path, which step 13 needs.
13. **Effort only on its own day (G21).**
14. **An objective's entries over a range (G18).** After this,
    `contract-coverage.itest.ts` holds every operation again.
15. **The plan so far (G14, G15, G23, G34).**
16. **Weeks (G16).**
17. **Today (G24–G28).** After 15, because it reads `figuresToDate` and `trackOf`.
18. **The reviews tab (G19, G20, G22).**
19. **The story.** `story.itest.ts` and `story-check.mjs` read back the whole design.

Steps 12–13 change what a client may write, so they come straight after the record
rules (1–11) and before the reads that rely on them (14–18).

**Chosen here because the spec does not say.** These are the candidates for the PR
body's *Decided, not specified*:

- A drifted deviation sent with a `reasoning` is accepted, and the reasoning is
  stored as null. The UI never sends it, and the database CHECK keeps drifted rows
  without it.
- The checks on a verdict run in this order: shape (400), then owner (404), then
  final (409), then needs a reason or is dated in the future (422). An authorisation
  probe across users therefore still gets 404. Effort follows the same order: 400,
  404, then 422 for not today, outside the plan or an overlap.
- Sending the same verdict twice, for example `approved` after `approved`, appends a
  second row. The history stays honest and needs no rule.
- A final row is current whatever its date. Since G37 a `taken` row is dated the day
  it is taken, so it is never before its approval in one zone; the rule still holds
  when the user's zone and the request's zone fall on different days.
- No check that a verdict is not dated before the current one. That would be a new
  422 the contract does not declare. → TRIAGE.
- `last_saved_at` is set by every successful PATCH, including an empty one (Save
  draft). It is left alone when a draft is started, so it is null until the first
  save, and it is not touched when the review is saved.
- Inside a review, a parked idea carries all its notes, not only those written by the
  period end. The design no longer shows parked ideas in a review, and removing
  `Review.parked_ideas` is in TRIAGE, so no time goes into a field that is leaving.
- The objectives list reads notes and then discards them. It stays one query, and the
  list has no reason to need a second SQL statement.
- **So far leaves out a flexible week in progress entirely**, its minutes as well as
  its target. Counting its minutes without its target would break logged = credited
  + over + extra. So mid-week, a flexible objective's *Logged effort so far* stops at
  the last full week.
- A week in progress in `Objective.weeks` reports its whole week's target. The UI
  labels it "so far".
- `upcoming_review_on` skips a window that ended with no planned day, because it can
  never become due. It is null once the objective is completed or ended.
- An entry that runs past midnight is compared only within its own day.
- Overlap is serialised by locking the user's row, not by a constraint, because the
  schema cannot see a user's entries across objectives.

## Risks

**Rolling back to an older image breaks part of the app after steps 2, 5, 6 and 12.
Accepted (Rohit, 2026-10-21).** Under ADR-004, a rollback deploys an older image onto the newer schema and
does not migrate. After step 2, the old image reads `what_went_right`, which no
longer exists, so every review read fails. After step 5, it writes reasoning on a
drifted deviation, which the new CHECK refuses. After step 6, it writes a drop
without a note, which the new CHECK also refuses. After step 12, it accepts an entry
without a start time, which `NOT NULL` refuses. All fail with 503. This is accepted
because nobody uses the app and there is no data. Rolling back past any of these
steps means rolling back its migration as well. Steps 3, 4, 8 and 9 only add to
the schema and stay safe to roll back. Not chosen: expand now, contract later, which
needs more migrations and a second PR.

**Step 13 changes how history can be made.** After it, no client can log a past
day, so no client can replay a story.
- `story.itest.ts` seeds its history through `testEntry` and posts only today.
- `story-check.mjs` has no database. It starts its objective four weeks ago and
  logs only today, so the past weeks have no effort, and its figure checks change.
  Accepted (Rohit, 2026-10-21).
- A client whose clock is wrong by a day gets 422 for an honest entry. The client
  sends `local_date` (NFR-12), and the server now checks it against its own clock.
- Every itest that seeded effort through the service now seeds it through the repo,
  so no seeded entry passes through the rules. The rules keep their own tests.

**Step 6 is still the riskiest step.**
- A final verdict wins whatever its date. If `assembleIdea` gets this wrong, a
  taken idea shows as approved.
- Postgres cannot use `ADD VALUE 'approved'` anywhere else in the same migration, so
  the new index names only `taken` and `dropped`.
- `lockIdea` serialises two requests that would each make an idea final, and the
  unique index backs it up. "No row after a final one" is enforced by the service
  alone.

**The API changes for anyone already calling it.** Review fields are renamed,
`taken_early` is removed, a drop needs a note, taking an idea needs approval, an
entry needs a start time, and effort can be written only on its own day. No UI
exists yet. The only callers are `story-check.mjs` and the itests, and the plan
updates both.

**The branch is inconsistent until the work is finished.** Integration CI is red
until step 14. Between steps 6 and 7, a parked idea can still be taken without
approval. All of it exists only on the branch.

**Code outside the spec changes in these places, and none of them breaks.** Each is
a change to something other features also use:
- A null `reasoning`, `pattern_nth` and `review_due_on` reach `GET /day`
  (`last_deviation`), the deviations in a review, and `GET /deviations`. All go
  through `present()`. Typecheck catches anything that treats `reasoning` as always
  a string.
- `IDEA_COLUMNS` is also read by reviews, so the parked ideas in
  `GET /reviews/{id}` gain notes, `approved`, `decided_early` and `verdict_on`.
- `OBJECTIVES_SQL` serves the list, the detail, the schedule grid and the create
  read-back, so it reads notes for all of them. `summaryOf` picks its fields one by
  one, so notes do not appear in the list.
- `updateReviewAnswers` now writes even for an empty PATCH, where it used to skip
  the database. The response does not change.
- `windowFigures` moves module, unchanged; reviews import it from effort.
- The Today query loses its Monday-week sum and gains every past day's minutes per
  objective. It is still one query, but it reads more rows as a plan gets older.

Effort month, status changes, extensions and the schedule grid do not use any
changed code. The new routes log ids only, never the text (NFR-11).

**A migration fails if real rows exist.** This is intended: it is how a wrong no-data
premise would show up. The migrate task fails and the deploy stops before the service
rolls.

## Proof

**The sum.** `adherence.md` rule 7 says logged = credited + over target + extra on
off days. `figures()` does not return credited, so the test derives it from its own
inputs: `credited = Σ min(inSlot, target)` over the slots. It then asserts
`logged_minutes === credited + over_target_minutes + extra_off_day_minutes` for every
case in `adherence.test.ts`: both worked-example tables, the paused week, zero slots
and zero entries. It does the same for `windowFigures` with fixed and weekly
windows, and for `figuresToDate` with a flexible week in progress (step 15). The
rule holds for `figures()` over any slot set, because covered days split cleanly
into slots: day slots are unique, week slots tile, and segments never overlap
(invariant 4). It holds for `windowFigures` only when every slot that covers a day of
the window starts inside it. Plan weeks (step 16) always meet that, because they tile
from the same segment start as week slots. A flexible week that straddles the start
of a monthly window covers days that `windowFigures` counts as neither credited nor
extra, so those minutes are lost. This is existing behaviour, not caused by this
intent, and it goes to TRIAGE in step 1 rather than into this plan. The figures the
worked examples state are asserted exactly:

| Case | Logged | Credited | Over | Extra |
|---|---|---|---|---|
| Fixed, Mon 120 | 120 | 60 | 60 | 0 |
| Fixed, Mon 60 + Sat 45 | 105 | 60 | 0 | 45 |
| Flexible, Mon–Thu 60 each | 240 | 180 | 60 | 0 |
| Fixed, paused Wed–Fri, Thu 60 | 60 | 0 | 0 | 60 |

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | The sum, as above. Adherence still ≤ 100 on every case. Flexible example: `planned_weeks` 1, `target_met_weeks` 1; a week short of target is planned but not met; fixed returns 0 and 0 | Pure; optional response fields are added |
| 2 | Migration up and down. The existing review tests pass with only names changed, so the assertions prove the rename changed no behaviour. The story's *Week 2 quotes Week 1* still holds under `previous_what_changes_next` | The contract already names the new fields; nothing outside the app reads the old ones |
| 3 | `validateReviewEdit` accepts `not_tried`; PATCH round-trips it; migration up and down | Additive enum value |
| 4 | Itest: null after start; set after a PATCH; later after a second PATCH; set by an empty PATCH; unchanged by save; present in `GET /objectives/{id}/reviews` | A nullable column |
| 5 | Unit: a drifted deviation without reasoning is valid, and one with reasoning stores null. A chosen one without reasoning is refused by `deviationRefusal`, no longer a 400 field error (the all-missing field list loses `reasoning`). Itest: drifted 201 with no `reasoning` key in the response; chosen without reasoning 422, nothing written. Schema itest: a drifted row with reasoning and a chosen row without are both refused by `deviation_reasoning_only_chosen` | Loosens one input and tightens the database to match |
| 6 | **Tests that change, and why.** `parking.test`: *refuses while locked* is deleted because the rule was reversed, replaced by *a locked idea takes any verdict* plus `final`, `needs_reason` and `future`. *Accepts parked or dropped* becomes parked, approved, dropped. Every `taken_early` becomes `decided_early`, plus cases for approved early, dropped early and parked never early. *Stays taken whatever is dated after it* becomes *a final row is current even when dated before the approval*, because a row after a final one can no longer exist. `verdicts.itest`: *a drop and a revival* becomes parked → approved → parked → dropped, then a revival is 409. *422s while locked* is reversed to 201 with `decided_early: true`. New cases: a drop without a note is 422 and a future date is 422, with nothing recorded. `parking-schema.itest`: *a second taken* now names `…_one_final_idx`, and taken + dropped is also refused. *Flip and flip back* becomes a parked/approved flip; new: a drop without a note is refused. `park.itest` and `take.itest`: the field is renamed, and the dropped-idea setup sends a note. Authorisation row: the verdict sends a note | The contract already describes this behaviour; the UI that relies on it is not built |
| 7 | `parking.test`: `canTake` reverses for a parked idea (true → false, because approval is now required) and is true for an approved idea, locked or not. `take.itest`: each take approves first. New: a parked, unapproved idea is 422 and no objective is written. The taken verdict's `occurred_on` is today in the request's zone even when `starts_on` is next week. The early take is approve-then-take of a locked idea, with `decided_early: true`. The all-or-nothing case is unchanged | Narrows an input the contract already narrowed |
| 8 | Unit: `validateNoteWrite`, `noteRefusal`. Itest: 201; returned in `GET /objectives/{id}` oldest first; accepted on a completed and an ended objective; 400; 404 for another user's objective (authorisation suite); 422 for a future `written_on`; `objectives-one-read` still one query | Additive route and table |
| 9 | As in step 8, for ideas: accepted on a dropped and a taken idea; `GET /parked-ideas` still one query with notes | Additive route and table |
| 10 | Unit: `verdict_on` is the final row's date when there is one, else the latest. Itest: `GET /parked-ideas?caught_on=X` returns a `new_idea_locked_until` equal to the `locked_until` of an idea then parked on X; without the parameter the field is absent; `caught_on=nope` is 400 | Additive fields and parameter |
| 11 | Unit `reviewDueOn`: a date in Week 2 gives Week 2's end; two objectives give the earlier end; a date in no window gives null; a monthly window clamps as `review-windows.md` says. Itest: three deviations on one pattern read `pattern_nth` 1, 2, 3 in `GET /deviations`, and the first still reads 1 after the third is recorded; no pattern gives null; another user's deviations on a same-named pattern do not count | Additive fields |
| 12 | Unit: a missing or out-of-range `occurred_at_local` is 400; `overlaps` for touching (09:00 + 60 against 10:00, allowed), nested, and partial intervals. Itest: an overlap across two of the user's objectives is 422 and nothing is written; another user's entry at the same time does not count; an edit that moves into another entry is 422; an edit that keeps its own time is 200; migration up and down | Tightens an input the contract already tightened |
| 13 | Unit `effortDayRefusal`. Itest: yesterday's and tomorrow's `local_date` are 422 on create; an entry seeded yesterday is 422 on PATCH and DELETE; today's in its own zone is 201, 200 and 204; an entry logged in `Asia/Kolkata` is judged in that zone, whatever the user's zone | Narrows inputs the contract already narrowed |
| 14 | Itest: entries in the range only, in time order, each with `occurred_at_local` and `extra`; `to` before `from` is 400; a missing parameter is 400; 404 for another user's objective (authorisation suite); `last_logged_on` equals the latest seeded date and is null with no entries. `contract-coverage.itest.ts` passes | Additive route and field |
| 15 | Unit `slotsToDate`, `figuresToDate`: a fixed plan at day 14 of 30 with every day met reads 100, not 47; a flexible week in progress leaves its target and minutes out, and the sum still holds; today's unlogged day slot counts. `trackOf` at 80, 79, 60, 59 and with no ended slot. `upcomingReviewOn` before any window is due, after a save, past a wholly paused window, and null once completed. Itest: the list shows `figures_to_date`, `track` and `status_since` after a pause | Additive fields; `windowFigures` moves with its tests unchanged |
| 16 | Unit `planWeeks`: a 30-day plan from a Sunday gives four full weeks and a 2-day fifth; an extension starts new weeks at its own start; each week's `figures` add up to the whole run's for a fixed plan. Itest: `GET /objectives/{id}` returns `weeks`, and the list does not | Additive field |
| 17 | Unit: a flexible card's `period_logged_minutes` and `period_days_worked` up to the date only; `today_planned_minutes` counts fixed day slots and skips flexible ones; `today_to_go_minutes` never goes below zero when a slot is over; `extra_off_day_minutes` includes Monday's extra when the date is Wednesday; `adherence_to_date` matches the objective's `figures_to_date` for the same rows; `start_date` on an objective that starts next week. Itest: still one query (`computed-slot`) | Additive fields; a declared field is finally returned |
| 18 | Unit: a `plan_end` review's `figures` equal `figures` over the whole plan to its end, while its `minutes_per_day` and deviations stay on its period. `what_changes_next` in the summary. Itest: `due` lists every due window oldest first, with `review_id` only for the one with a draft; a saved window leaves `due`. `plan-end.itest`'s figures change to the whole plan, which is the reversed rule | Changes one figure the spec reversed; the rest is additive |
| 19 | `story.itest.ts` in CI; `story-check.mjs` against `npm run dev` | Test and script only |

Every step passes `format:check`, `lint`, `typecheck`, `test:tz`, `contract`, `build`
and `commitlint` locally before its commit. Integration tests run in CI.
