# Plan — I-09 · Calendar weeks and months, and v1 plans fixed objectives

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-10-24 · **Written:** 2026-10-24

## What the code has today, and what changes

| Today | Where | Becomes |
|---|---|---|
| Windows tile from the segment start: weekly `[S+7k, S+7k+6]`, monthly `[addMonths(S,k), addMonths(S,k+1)−1]`, last clipped to E | `reviews/domain/reviewWindows.ts` `reviewWindows` | Calendar periods (Mon–Sun weeks, calendar months) overlapping `[S, E]`, clipped to it; a first or last period under 4 days (weekly) / 15 days (monthly) joins its neighbour; `seq_in_seg` renumbered after joining. The last is still `plan_end` |
| Plan weeks are `reviewWindows("weekly", …)` per segment | `objectives/domain/planWeeks.ts` | No code change: it follows. The comment's "seven days tiled from each segment's start" is rewritten |
| New objective offers Fixed or Flexible | `objectives/new/NewObjectiveForm.tsx`, `domain/newObjective.ts` | Fixed only: no choice cards, no Days a week, no weekly target. `Draft` loses `mode` and `daysPerWeek`; `perDayShare` and the flexible target checks go |
| `POST /v1/objectives` accepts a flexible schedule | `validateObjectiveWrite.ts` | A well-formed flexible schedule is a new refusal `kind: "fixed_only"` → `422` |
| An extension accepts a flexible schedule | `validateExtension.ts` `extensionDecision` | Refused as `kind: "fixed_only"` → `422`, checked after the objective is found, so another user's objective is still `404` |

**Follow without a rule of their own** (spec): `reviewSchedule`, `dueWindows`,
`upcomingReviewOn`, `reviewDueOn` (deviations), `assembleObjective`, `assembleReview`,
and New objective's preview (`preview` calls `reviewWindows`). Today's "This week"
already runs Monday to Sunday (`assembleDay.ts` `weekOf` → `mondayOf`); unchanged.

**Reused, not copied:** `mondayOf` (`effort/domain/effortMonth.ts`) for the week
boundary; `parseIso`/`toIso` (`objectives/domain/generateSlots.ts`) for date maths.
`addMonths` stays: New objective's plan length still uses it (spec, *What does not
change*).

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/intents/I-09-week-alignment/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 2 | `src/modules/reviews/domain/reviewWindows.ts`, `reviewWindows.test.ts`; `objectives/domain/planWeeks.ts` (comment), `planWeeks.test.ts`; unit tests whose window dates move (`assembleObjective.test.ts`, `assembleReview.test.ts`, `newObjective.test.ts` review counts, any other found by `npm run test:tz`) | The calendar rule. Pure, one function; every caller follows |
| 2 | itests pinning windows on a non-Monday start or a month that isn't a calendar month, if any (audit: `review-due`, `start-review`, `save-review`, `review-schema`, `plan-end`, `deviations`, `objectives`, `story`); `src/modules/reviews/review-due.itest.ts` | Every audited itest starts on a Monday (`2026-09-14`, `2026-11-02`, `2099-01-05`) or runs under one month, so none is expected to move. One new itest: the intent's check — a Thursday start and a Monday start both have weekly reviews ending on Sundays; a monthly objective from the 10th ends its reviews on month ends |
| 3 | `src/modules/objectives/domain/newObjective.ts`, `newObjective.test.ts`; `src/app/(app)/objectives/new/NewObjectiveForm.tsx`, `newObjective.module.css` | Fixed only. The Schedule card shows the weekday checkboxes and Daily target, with no choice cards. Flexible fields, `perDayShare` and the flexible checks are removed; the grid contract test keeps fixed drafts only |
| 4 | `src/modules/objectives/domain/validateObjectiveWrite.ts` (+ test), `validateExtension.ts` (+ test); `src/modules/objectives/service.ts`; `src/app/v1/objectives/route.ts`, `[objectiveId]/extensions/route.ts` | `fixed_only` refusal → `422`, type `problemType("fixed-only")`, title "v1 plans fixed objectives only". Create: after the 400 fields and the mode mismatch. Extension: in `extensionDecision`, before the review checks |
| 4 | `src/test/fixtures.ts`; `objectives.itest.ts`, `committed-minutes.itest.ts`; `create-objective.itest.ts`, `extension.itest.ts` | A `testFlexibleObjective` fixture inserts through `insertObjective` directly (test-only), so the itests that read flexible plans keep their flexible objective (spec: the read backend stays, tested). New itests: create flexible → 422, no row written; extend with flexible → 422, no segment written |
| 5 | `docs/intents/TRIAGE.md` | Anything found outside the intent |

`src/test/authorization-table.ts` keeps its flexible extension body: the objective is
looked up first, so another user's still answers 404.

## Order of work

1. **Accept the plan.** `plan.md` committed alone.
2. **Calendar windows.** `reviewWindows` changes; reviews, plan weeks, deviations'
   `review_due_on` and the New objective preview follow.
3. **New objective offers Fixed only.** Before the API refuses flexible, so `main`
   never has a page offering what the API turns down.
4. **The API refuses flexible**, on create and on extend.
5. **Proof** on localhost, then TRIAGE. The intent's check runs on the deployed service
   after the merge.

No migration (windows and weeks are computed; spec, *Data already stored*), no infra,
no dependency. The contract and domain docs are already changed in the spec commit.

---

## Risks

**What could break**

- **Every review read.** `reviewWindows` feeds due reviews, the next review, a
  deviation's `review_due_on`, plan weeks and starting a review. A wrong join puts a
  review on the wrong day everywhere at once.
- **Starting a review whose period moved.** `POST /reviews` matches the period sent
  against the schedule. A draft started before the deploy on a non-Monday objective
  has an old period: it no longer matches a window and its period shows as due again.
  Accepted in the spec; only test users exist.
- **Joining edge cases.** Two short periods (Sat–Tue) must join into one `plan_end`;
  a segment of 1 day; a month-end start (31 Jan); February in a leap year; an
  extension whose segment starts mid-week, with labels running on.
- **Flexible itests losing their objective.** Once create refuses flexible, the
  fixture that reads flexible plans must not go through `createObjective`.
- **Flexible weeks cut by a plan week.** Stored flexible objectives keep week slots
  tiled from their start, so a calendar plan week can cut one, and those minutes drop
  from that week's figures (`adherence.md` already says so). No new one can be made.
- **Itests run in CI only.** The audit says none moves; if one does, it fails in CI,
  not locally.

**The riskiest step: 2.** One function under every review on every screen.
Mitigations: the spec's named cases (every start weekday, short first/last in both
cadences, leap February, Sat–Tue, extension labels) in `reviewWindows.test.ts` at 100 %
(ADR-007), each worked example in `review-windows.md` as a test, and a property test:
windows tile `[S, E]` with no gap or overlap, every weekly window but a joined one
ends on a Sunday, and no window is short unless it is the only one.

**What was not chosen**

- **A stored week start, or a user's choice of first weekday.** Out of scope.
- **Joining Today's week.** Today's "This week" stays the plain Mon–Sun week; only a
  plan's first and last week join, so near a plan's ends the two can differ by up to
  3 days. The spec only says both run Monday to Sunday.
- **Dropping the flexible read backend** (`generateSlots` weeks, `coveringSlot`,
  `committedMinutes`). It stays with its tests for v2 (spec).
- **Keeping the page's flexible rules in `newObjective.ts`.** They describe a
  schedule the API refuses, so the grid test would prove nothing; v2 writes them again
  on the new week (TRIAGE).
- **Refusing flexible as a 400 field error.** The contract says `422`.
- **Refusing a flexible extension before the ownership check.** That would answer
  `422` for another user's objective; checked after the lookup, it stays `404`
  (NFR-10).
- **Migrating saved reviews to the new periods.** Spec: nothing is migrated.

---

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | — | Docs only |
| 2 | `reviewWindows.test.ts`, 100 %: every row of the worked-examples table in `review-windows.md`; starts on each weekday Mon–Sun (Sun end, 1–3-day first week joined); a 1–3-day last week joined, 4 days alone; months ending on the last day, Feb 2027 and Feb 2028; a 12- and a 14-day first month joined, 15 alone; Sat–Tue → one `plan_end`; a 1-day segment; an extension starting Monday 09-28 → Week 3, End of plan `10-05…10-14`; fully and partly paused windows unchanged. A property test over many (S, E, cadence). `planWeeks` equals the weekly windows. itest (CI): the intent's check | Every read follows one function; no stored data |
| 3 | `newObjective.test.ts` at 100 %, the grid contract test over fixed drafts. Chrome 1280 / 390 px: the Schedule card has no choice cards; the preview's Reviews and "The last one, on …" match the calendar rule (Thu start, 4 weeks → the last review on a Sunday) | The page sends only fixed, which the API already accepts |
| 4 | `validateObjectiveWrite.test.ts`, `validateExtension.test.ts`: flexible → `fixed_only`; bad flexible fields are still 400; fixed with `days_per_week` still a mismatch. itests (CI): create flexible → 422, no row; extend with flexible → 422, no segment; another user's objective → 404 (authorization table); flexible reads still pass on the fixture | The page stopped offering flexible in step 3 |
| 5 | Chrome, local: objectives started Thu and Mon → weekly reviews end on Sundays, and `GET /v1/objectives/{id}` `weeks` match them; monthly from the 10th → reviews on month ends. After the release: the intent's check on the deployed service | — |

Integration tests run in CI only; `npm run test:tz` covers the domain locally.
