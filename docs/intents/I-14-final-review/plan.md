# Plan — I-14 · Final review: Complete and Extend

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-11-03 · **Written:** 2026-11-03

## Context

A final review falls due and shows on the Reviews tab and the Overview banner, but
it can't be opened. The tab says "Opens in a later release.", and its address says
"This screen isn't built yet." So no objective can finish. The API can already save
a `plan_end` review with an outcome and a criteria verdict, and saving `completed`
writes the status event. `POST /extensions` adds a segment, and the history already
words both outcomes (`objectiveView.ts` `eventRow`). Two server changes are missing:

- **G48:** a late extension plans from the day it is made (`plans_from`, ADR-008
  I-14 amendment).
- **Per-segment review cadence,** decided while this plan was written (Rohit,
  2026-11-03). The spec asks Extend for the extension's review cadence, and says
  later reviews follow it. Today cadence is only `objective.review_cadence`, and no
  write can change it. Changing it on the objective would re-tile past windows and
  orphan saved reviews, so each segment carries its own cadence. This changes the
  design, so step 1 amends the documents that own it, before the plan is accepted.

## What the code has today, and what changes

| Today | Where | Becomes |
|---|---|---|
| A segment plans from `start_date` | `generateSlots` (`daySlots`, `weekSlots`), `toSegment` | No slot before `plans_from`. Every reader gets it through `toSegment` |
| An extension starts and ends from `old end + 1` | `extensionDecision` (`validateExtension.ts`) | It starts at `old end + 1` and plans from `max(old end + 1, today)`. Its end is `plans_from + days − 1`. `extensionSpan()` is exported and is the one rule the preview also uses |
| One cadence per objective | `reviewSchedule(cadence, segments)`, `reviewDueOn`, `assembleObjective`, `reviews/service.ts`, `deviations/service.ts` | `SegmentSpan` carries its cadence and `plans_from`. `reviewSchedule(segments)` tiles each segment by its own cadence, and a first window's shortness counts only days from `plans_from` |
| Segment SQL selects no `plans_from` and no cadence | `objectives/repo.ts`, `reviews/repo.ts`, `today/repo.ts`, `effort/repo.ts`, `deviations/repo.ts` | Each selects both. The inserts write both |
| A final review can't be opened | `actionOf` (`reviewView.ts`), `FINAL_LATER`; `[reviewId]/page.tsx` | It opens like any review: oldest first, as a draft |
| The history reads the objective's cadence | `history` and `eventRow` (`objectiveView.ts`) | "Started …" and "Created" use segment 0's cadence; an extension's line uses its own segment's |

**Reused, not copied:**
- **The whole plan's week rows:** `Objective.weeks` (`planWeeks`), up to the review's `period_end`.
- **Figures:** the review's own `figures`, which already cover the whole plan (G22, I-03).
- **The form:** from I-13, `ReviewForm`'s cards (Last change, Chosen deviations, Reflect), `Choices`, `useAutosave`, `DiscardDialog`, the `sending` ref, `Numbers`, `ReviewHead`, `CardHead`.
- **The schedule fields:** the weekday checkboxes and the h/m target from `NewObjectiveForm`, and `missesEveryWeekday` and `normaliseSchedule` (`validateObjectiveWrite.ts`).
- **Words:** `addMonths` (`reviewWindows.ts`); `dayLabel`, `duration`, `scheduleLine`; `VERDICT` for the criteria (`objectiveView.ts`).

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/keel-api.yaml`, `docs/erd.md`, `docs/adr/ADR-008-scheduling-logic.md`, `docs/domain/review-windows.md`, `docs/design/contract-gaps.md` | Per-segment cadence: `review_cadence` on `plan_segment` and `PlanSegment`; required in the `POST /extensions` body; windows tile each segment by its own cadence; a first window is short by its days from `plans_from`; `Objective.review_cadence` is the latest segment's |
| 2 | `docs/intents/I-14-final-review/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 3 | `migrations/<ts>_segment-plans-from-and-cadence.cjs` *(new)*; the five repos above; `objectives/domain/segmentRows.ts`, `rows.ts`, `assembleObjective.ts` (+ test); `src/shared/contract.ts`; `src/test/fixtures.ts`; `objectives/schema-constraints.itest.ts` | Two additive columns, backfilled. Read and written everywhere, and returned on `PlanSegment`. Behaviour unchanged |
| 4 | `objectives/domain/generateSlots.ts`, `segmentRows.ts`, `validateExtension.ts` (+ tests, `coveringSlot.equivalence.test.ts`); `objectives/repo.ts` `insertSegment`; `objectives/extension.itest.ts` | G48: no slot before `plans_from`; a late extension plans from today |
| 5 | `reviews/domain/reviewWindows.ts` (+ test); `objectives/domain/planWeeks.ts` (+ test); `objectives/domain/assembleObjective.ts`, `objectiveView.ts` (+ tests); `objectives/domain/validateExtension.ts`; `reviews/service.ts`, `deviations/service.ts`; `reviews/plan-end.itest.ts`, `objectives/extension.itest.ts`, `src/test/authorization-table.ts` | Each segment's own cadence in windows, labels, due, history; a late extension's first window joins forward until it is no longer short; the extension takes `review_cadence` |
| 6 | `reviews/domain/finalReview.ts` *(new, + test)* | The final review's pure rules and words, below. Unused yet |
| 7 | `objectives/review/SavedReview.tsx`, `PlanNumbers.tsx` *(new)*, `review.module.css`; `[reviewId]/page.tsx` | The saved final review, read-only |
| 8 | `objectives/review/FinalReviewForm.tsx`, `ExtendFields.tsx` *(new)*; `ReviewCards.tsx` *(new, extracted from `ReviewForm.tsx`)*; `ReviewForm.tsx`; `[reviewId]/page.tsx`; `review.module.css` | The final review as a form, Complete and Extend |
| 9 | `reviews/domain/reviewView.ts` (+ test); `objectives/ReviewsTab.tsx`, `ObjectiveDetail.tsx`, `objectives.module.css`; `SavedReview.tsx` | The final review opens from the tab and the banner. G49's "The extension wasn't made." on the Overview and the saved review |
| 10 | `docs/intents/TRIAGE.md` | The findings below |

All `objectives/review/…` and `[reviewId]/…` paths are under `src/app/(app)/objectives/`. All `objectives/domain`, `reviews/…` and `deviations/…` paths are under `src/modules/`.

### The pure rules (step 6) — `reviews/domain/finalReview.ts`

- **Plan in numbers:** `planRows(o.weeks, review)` gives one row per plan week up to `period_end`: "Week 1", a bar, "90%" and its tone. A short last chunk is labelled by its days ("Mon 31–4"). The hint is "All 26 days", the days from the plan's start to `period_end`. The tiles are `tiles(review, null)`, so there's no comparison.
- **Success criteria:** the quote, and "Set 9 Aug" from the `created` event's date. `CRITERIA` maps `met` → Met, `partly_met` → Partly met, `not_met` → Not met. The text is capped at 280.
- **Extend fields:** `extendDraft(o)` fills them from the latest segment: its weekdays, its minutes, its cadence, n = 2 weeks.
  - `extendDays(n, unit, plansFrom)`: weeks are 7n. Months run up to the day before `addMonths(plansFrom, n)`.
  - `extendPreview(o, draft, today)` calls `extensionSpan` from `validateExtension.ts`, the same function the server uses. It gives "Sat 5 – Fri 25 Sep · new end Fri 25 Sep", or "Plans from Mon 14 Sep · new end Sun 4 Oct".
  - `changedFrom(draft, o)`: "Changed from Mon–Sat · 5 planned days a week", and "was 2h 00m a day".
- **Checks:** `checkFinal(answers, verdicts, review, outcome, draft)` returns every error in the design's words, in page order: I-13's checks, then
  - "Pick where you are against the success criteria."
  - "Write what shows it."
  - "Pick Complete or Extend."
  - "Enter how long to extend."
  - "Keep an extension to six months or less." (more than 26 weeks or 6 months)
  - "Pick at least one day."
  - "Set a target above zero."
  - "Write why the extra time is worth it."
- **Bodies:** `finalPatch(answers)` adds `criteria_verdict`, `criteria_assessment` and `outcome` (`completed` or `continued`, G9). `extensionBody(review, draft, plansFrom)` builds the extension request.
- **Words:**
  - `saveLabel(outcome)`: **Save review and complete** or **Save review and extend**;
  - `EXTEND_BAR`: "The extension and its schedule go into the status history.";
  - `completedToast(title)`: "Review saved. {title} is completed.";
  - `extendedToast(end)`: "Review saved. Extended to Fri 25 Sep.";
  - `EXTENSION_NOT_MADE`: "The extension wasn't made.", and **Make the extension**.
- **Saved:** `whatNext(review, o)` gives "Completed with this review", or "Extended to Fri 25 Sep" with the schedule line, the cadence and the reason, from the segment whose `created_by_review_id` is this review.
- **G49:** `pendingExtension(o, reviews)` gives the saved `plan_end` review whose outcome is `continued`, whose `period_end` is the plan's end, and which no segment names. Otherwise null. This derives it; nothing is stored.
- **`reviewView.ts` (step 9, not 6):** `actionOf` no longer special-cases `plan_end`, and `FINAL_LATER` goes. Removed earlier, the live tab would offer **Start review** onto the placeholder page between steps 6 and 8.

---

## Order of work

1. **Amend the design for per-segment cadence.** Docs only. Rohit accepts the change before step 2. The contract gains:
   - `PlanSegment.review_cadence`, required;
   - `review_cadence` in the `POST /extensions` body, required;
   - `Objective.review_cadence`, described as the latest segment's.

   The ERD gets the column, and ADR-008 gets a second I-14 note. `review-windows.md` gets two changes:
   - each segment tiles by its own cadence, and labels count per word (Week 1–3, End of plan, Month 1 …);
   - a first period is short when it has fewer than half a period's days **from `plans_from`**, not from `start_date` (Rohit, 2026-11-03). It joins the next period, again and again, until it isn't short. Windows still start at `start_date`, and the last-period rule is unchanged. A segment whose `plans_from` is its `start_date` tiles exactly as before.
2. **Accept the plan.** `plan.md` committed alone.
3. **The columns.** One migration:
   - `plans_from date`, backfilled to `start_date`, then `NOT NULL` and `CHECK (start_date <= plans_from AND plans_from <= end_date)`;
   - `review_cadence`, using the existing `review_cadence` enum, backfilled from the objective, then `NOT NULL`;
   - the contiguity trigger is untouched;
   - down drops both columns.

   Every segment read selects both, and `createObjective` and `insertSegment` write them: `plans_from = start_date`, and the objective's cadence. `PlanSegment` returns them. Nothing reads them yet.
4. **G48.**
   - `SegmentForSlots.plansFrom`: day slots start at it, and a week slot drops the days before it (capping `targetDays`, as pauses do).
   - `extensionDecision`: `start = old end + 1`, `plans_from = max(start, today)`, `end = plans_from + days − 1`. `missesEveryWeekday` runs over `[plans_from, end]`. Those dates are `extensionSpan(oldEnd, today, days)`.
   - Every existing row has `plans_from = start_date`, so every figure stays as it was.
5. **Per-segment cadence.**
   - `SegmentSpan` gains `cadence` and `plans_from`, and `reviewSchedule(segments)` and `reviewDueOn` read them.
   - `reviewWindows`: the first-period join measures days from `plans_from` and repeats while the joined period is still short. Example: an old end on Fri 4 Sep and an extension made Fri 11 Sep (Mon–Sat). Sat 5 – Sun 6 has no days from `plans_from`, and Sat 5 – Sun 13 has 3, so the first window is **Sat 5 – Sun 20**, with 8 planned days, not Sat 5 – Sun 13 with 2.
   - `planWeeks` uses the same windows, so the final review's week rows join the same way, and "Week 2" still means the same days everywhere.
   - `assembleObjective` returns the latest segment's cadence as `review_cadence`.
   - The history uses segment 0's cadence for "Started … with weekly reviews" and "Created", and each extension's line uses its own segment's. Without this, the original plan's line would show the extension's cadence.
   - `authorization-table.ts` sends `review_cadence` in its extension body: shape is checked before owner, so without it the 404 checks would get a 400.
   - `validateExtensionWrite` requires `review_cadence`, and the new segment stores it.
6. **The pure rules,** at 100 % (ADR-007). Unused yet.
7. **The saved final review.**
   - `[reviewId]/page.tsx` drops the `plan_end` placeholder for a saved review.
   - `SavedReview` renders five cards: Plan in numbers (`PlanNumbers`: tiles, then the week rows; no day bars); Last change and Chosen deviations; Success criteria with its verdict pill; Reflect; and What next.
   - A draft final review still shows "This screen isn't built yet." until step 8. No screen links to one yet.
8. **The final review form.**
   - First, `ReviewForm`'s Last change, Chosen deviations and Reflect cards move to `ReviewCards.tsx`, with no change in behaviour (a weekly review re-proved in Chrome). Then `FinalReviewForm` composes them with Plan in numbers, Success criteria and What next.
   - **Autosave** carries the criteria verdict, the criteria text and the outcome, through the same `useAutosave`. The Extend fields live in the page only (see Decided).
   - **Save:**
     - `checkFinal` runs first. Every error shows at once, with scroll and focus on the first;
     - then the `sending` ref, the `PATCH` flushed, and `POST /reviews/{id}/save`;
     - **Complete:** go to `?tab=reviews` with `completedToast`;
     - **Extend:** then `POST /objectives/{id}/extensions`. On 201, go to `?tab=reviews` with `extendedToast`;
     - **the extension fails** (G49): the page stays, the review fields lock, and the banner reads `EXTENSION_NOT_MADE` with **Make the extension**, which retries with the held values. The `sending` ref is cleared on every way out;
     - **the save fails:** I-13's `NOT_SAVED`, and nothing is lost.
   - The draft is still reachable only by its address.
9. **Open it, and G49 everywhere.**
   - `actionOf` drops its `plan_end` case and `FINAL_LATER` goes, so `dueCards` and `dueBanner` give a final review **Start review** or **Continue draft**. This lands with the form already in place, so no live button leads to the placeholder.
   - When `pendingExtension` is set, the Overview shows "The extension wasn't made." with **Make the extension**. It links to the saved final review at `?extend=1`.
   - The saved final review shows the same note. **Make the extension** opens `ExtendFields` there, filled from the current plan, with a reason field and **Make the extension**.
10. **TRIAGE.**
11. **Proof** on localhost. The intent's check runs on the deployed service after the merge.

No new dependency and no infra. One migration, additive.

---

## Risks

**What could break**

- **Every figure (step 4).** `generateSlots` feeds Today, effort, the objective figures, the grid and the reviews. A wrong `plans_from` reading would move adherence everywhere.
- **Every review window (step 5).** If a segment's cadence read wrong, saved reviews would stop matching their windows: due counts, labels and "Opens after" would all shift.
- **The deploy window (step 3).** The release runs the migration, then rolls the service. Between the two, the old tasks still insert segments without `plans_from` and `review_cadence`. A create or an extension in those minutes fails `NOT NULL`, returns 500, and can be retried.
- **A rollback (step 3).** `migrate:down` drops `plans_from`. Once a late extension exists, rolling the schema back loses that fact, and the old code reads its gap days as planned and missed.
- **The history's first line (step 5).** `Objective.review_cadence` becomes the latest segment's. Anything that reads it to describe the original plan would show an extension's cadence.
- **A test that sends extensions (step 5).** `review_cadence` becomes required, and `authorization-table.ts` already sends extension bodies.
- **A button onto the placeholder (step 6).** Opening the final review from the tab before its form exists would send users to "This screen isn't built yet."
- **Preview and server disagree.** If the page computed "new end" by itself, it could promise dates the server won't plan.
- **Save, then extend (step 8).** The second call can fail after the first. Retrying must not make two segments.
- **Extract `ReviewCards` (step 8).** Moving the cards out of `ReviewForm` could break the weekly review that is live.
- **Fields lost.** The Extend fields aren't autosaved. Leaving the page drops them.

**How each risk is handled**

| Risk | Handling | Prevented by | Proved by |
|---|---|---|---|
| Figures move | Prevented | Backfill `plans_from = start_date`; only an extension made in step 4's code can differ | All existing unit and itests pass unchanged; `generateSlots.test` with `plansFrom` mid-segment, flexible and fixed |
| Windows shift | Prevented | Backfill the cadence from the objective, and `plans_from = start_date`, so `reviewSchedule` gets the same input and the join counts the same days | `reviewWindows.test`: a mixed-cadence pair; existing labels identical; every existing case with `plans_from = start_date` unchanged |
| A late extension's first review judges two days | Prevented | The first-period join counts days from `plans_from` (Rohit, 2026-11-03) | `reviewWindows.test` and `extension.itest.ts`: the Fri 11 Sep example |
| Deploy-window insert fails | Accepted | Minutes, one user, retryable; a two-release rollout isn't worth it | — |
| Rollback loses `plans_from` | Prevented | Roll back the image only, never `migrate:down`, once this is released: the columns are additive and the old code ignores them | The migration's down is run locally only, in step 3's proof |
| History shows the wrong cadence | Prevented | Segment 0's cadence for Started and Created; each extension's own for its line | `objectiveView.test`: weekly plan extended as monthly |
| Authorization itest gets 400 | Prevented | `authorization-table.ts` sends a full extension body | `test:integration:tz` in CI |
| Final review opens onto the placeholder | Prevented | `FINAL_LATER` removed in step 9, after the form exists in step 8 | Step 6–8 Chrome: the tab still says "Opens in a later release." |
| Preview disagrees | Prevented | `extensionSpan` is one function, used by `extensionDecision` and `extendPreview` | Unit test: both give the same dates; Chrome: preview against the created segment |
| Two segments | Prevented | The server allows one per review (invariant 7, 409), under the objective lock | itest: a second POST with the same review is a 409 |
| Weekly review broken by the extract | Prevented | A move with no logic change; the same `reviewForm.ts` | Chrome: I-13's step-5 checks re-run on a weekly draft |
| Extend fields lost | Accepted | Leaving and coming back refills them from the current plan, as the design allows | Chrome |

**The riskiest step: 4.** It changes the one slot rule that every number in the app
comes from. Mitigations:
- `plans_from` equals `start_date` on every existing row, so step 4 is a no-op for every objective until a late extension is made.
- `generateSlots.test` and `coveringSlot.equivalence.test` add a mid-segment `plansFrom`, and every other test stays unchanged.
- itests make a late extension and check that the gap days are extra, not missed, that adherence uses only the planned days from today, and that no window holding only gap days becomes due.

**What was not chosen**

- **One call for save and extend.** G49 keeps two calls.
- **Storing the Extend fields with the draft.** The review has no columns for them, and adding some would be a contract change for a convenience.
- **Changing `objective.review_cadence`.** It would re-tile past windows. The column stays, written at create and no longer read (TRIAGE).
- **A trigger for `plans_from`.** It's a `CHECK`, per the amendment.
- **Flexible extensions; Pause, Terminate and the other outcomes.** These are out of scope (I-09, spec).
- **A loading page.** It's server-rendered, as in I-11 to I-13.

**Decided, not specified** (for the PR)

- **Labels across a cadence change** count per word: Week 1–3, End of plan, Month 1.
- **"Set 9 Aug"** is the `created` event's date, the day the criteria were declared.
- **Months** run from `plans_from` to the day before `addMonths(plans_from, n)`. The six-month limit is 26 weeks or 6 months.
- **Extend fields** default to 2 weeks and the latest segment's weekdays, minutes and cadence.
- **Make the extension** from the Overview opens the saved final review at `?extend=1`. The design doesn't say where the fields open.
- **Complete** goes back to `?tab=reviews`, like any saved review.
- **After a failed extension,** the page stays and locks the review fields, so the held values can be retried.

---

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1, 2 | `npm run contract` | Docs only |
| 3 | `schema-constraints.itest.ts`: the `CHECK` refuses `plans_from` outside the range, and the backfill is equal to `start_date` and to the objective's cadence. `assembleObjective.test`: `PlanSegment` carries both. The migration runs up, down and up locally; after release, a rollback is the image only | The columns are additive and backfilled, and nothing reads them for a rule yet |
| 4 | `generateSlots.test`, `validateExtension.test` (on time: `plans_from = start`; late: `= today`; end from `plans_from`; weekdays checked over the span); equivalence test. `extension.itest.ts` (CI): a late extension's gap days are `extra`, its figures plan only from today, and nothing before is due | Identical output for every existing row |
| 5 | `reviewWindows.test`: mixed cadences, labels, `reviewDueOn`; a late extension whose gap ends early in a week joins forward (weekly, and monthly at 15 days); a gap spanning several whole weeks joins them all; a join that reaches the end makes one `plan_end` window; an on-time extension tiles as before. `planWeeks.test`: the same joined weeks. `objectiveView.test`: a weekly plan extended as monthly keeps "with weekly reviews" on Started and "monthly reviews" on the extension. itests, including the authorization table with the new body: an extension with `monthly` gives monthly windows after a weekly plan; earlier saved reviews keep their windows | Every existing segment has the objective's cadence |
| 6 | `finalReview.test.ts` at 100 % under `test:tz`: rows with a short last chunk; every error in order; weeks and months to 26 and 6, and over; on-time and late previews equal to `extensionSpan`; `pendingExtension` in each case; every word | Unused |
| 7 | Chrome at 1280 and 767 px on final reviews saved through the API, one completed and one extended: five cards, verdict pill, What next | It only reads; drafts still show the placeholder |
| 8 | Chrome on drafts made through the API: every check at once; autosave of the criteria and outcome; Complete; Extend on time and late, with the preview equal to the created segment; the extension blocked, then **Make the extension**; a double click sends once; a weekly review still works | Reachable only by address |
| 9 | `reviewView.test.ts` at 100 %: a final review's card and banner give Start or Continue. Chrome: the tab and the banner open the final review; a completed objective leaves Today; an extended one returns on its new days, with later windows on its new cadence and the history line; G49 on the Overview and the saved review; keyboard only; phone | — |
| 10 | — | Docs only |
| 11 | After the release, the intent's check on the deployed service | — |

**Test data:** objectives are made through the API on a local account, with a start
date in the past so the plan has ended. One ends yesterday, to test an on-time
extension. One ended a week ago, to test a late one. One is monthly. A failed
extension is made by blocking `POST /extensions` in Chrome.

**TRIAGE (step 10):**
- `objective.review_cadence` is written at create and no longer read; drop it or keep it as the creation fact.
- Today shows "Plan ended · final review due" (G45) for an objective whose final review was saved with Extend but whose extension wasn't made. It should say the extension is owed.
