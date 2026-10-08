# Plan — I-01 · Declare an objective

**Intent:** `intent.md` · **Spec:** `spec.md` (Accepted 2026-10-07) · **Status:** ACCEPTED 2026-10-07 · **Written:** 2026-10-07

## What is already built, and what is not

Read from the code, not the documents:

- **Schema is complete for I-01.** `objective`, `plan_segment` (with
  `plan_segment_mode`, `_planned_weekdays` 1–127, `_days_per_week` 1–7,
  `_minutes_positive`, `_no_overlap`, `_contiguous`) and `status_event` (with
  `status_event_one_created_idx`). **No migration in this plan.**
- **Domain:** `generateSlots` makes fixed day slots and **throws on flexible**.
  `coveringSlot` / `nextPlannedDate` skip flexible segments. That is the gap the W4-29
  review found: a flexible objective shows on Today unplanned, with every entry extra.
  Its expiry condition was "before `POST /objectives` accepts flexible", which is this
  intent. `statusOn` / `currentStatus`, `toSegment`, `scheduleLabel` and
  `bitmaskToWeekdays` / `weekdaysToBitmask` are reusable as they are.
  `effort/domain/adherence.ts` is a scaffolding stub with **no callers**.
- **Infra:** `shared/db.ts` has `query` and no transaction helper. Today's repo is the
  one-query pattern (CTEs + `json_agg`) to copy. Routes follow
  `app/objectives/[objectiveId]/effort-entries/route.ts`: UUID check → 404, JSON parse
  → 400, result-kind switch, catch → 503, wrapped in `withRequestLog`. The current
  user is `getConfig().seedUserId` until E-06.
- **Contract:** all four operations exist (`createObjective`, `listObjectives`,
  `getObjective`, `getObjectiveSchedule`). `ObjectiveWrite` already carries
  `starts_on` and `tz`.

## Decided in planning (Rohit, 2026-10-07)

1. **400 and 422 both stand, as the contract says.**
   - `400`: a field that is wrong on its own. Examples: empty weekdays, minutes < 15, a malformed date, a bad zone.
   - `422`: weekdays given for a flexible schedule, or a count for a fixed one.
   - The spec's "the contract's 400" reads as "a contract response, never a 500".
2. **`tz` is validated, not stored.** An invalid IANA zone gets a `400`. The objective
   records only a date, so a zone would be stored and never read. This is the ERD's own
   reasoning for `status_event`. The contract's `tz` description says so.
3. **The day states** (the option chosen: a flexible day is "worked or not") are design,
   not plan. The grid, the review and the review detail all render them. Step 5 writes
   the rule to `docs/domain/day-states.md`, and that file is the authority.
4. **Adherence** (the option chosen: minutes, capped per slot) is design, not plan. It
   has six call sites (ADR-001). Step 4 writes the rule to `docs/domain/adherence.md`,
   and that file is the authority.

Both files follow `docs/domain/review-windows.md`'s shape: what the rule is not, its
signature, the rule, worked examples, edge cases the tests must carry, and decisions
taken. Each is committed in the same commit as the code that implements it.

## Files that change

| Step | File | Change |
|---|---|---|
| 1 | `src/modules/objectives/domain/generateSlots.ts` (+ `.test.ts`) | Flexible → **week slots**. Week *k* is `[S + 7k, S + 7k + 6]`, clipped to the segment end, so the last week may be short. This is the weekly window `docs/domain/review-windows.md` already defines (line 61, "Tile from the start", and rule 2's clip), so a flexible week and a weekly review cover the same days. Each week gets `target_days = min(days_per_week, days in block)` and `target_minutes = target_days × minutes`. `GeneratedSlot` widens to `day \| week` |
| 1 | `src/modules/objectives/domain/planSlots.ts` *(new)* (+ test) | `planSlots(segments, statusEvents)`: generated slots filtered by status. A day slot is dropped if that day isn't active. A week slot counts only active days, `target_days` is capped by them, and the slot is dropped at zero. This is the one place pause suppression lives |
| 2 | `src/modules/objectives/domain/coveringSlot.ts` (+ test) | `coveringSlot` / `nextPlannedDate` read `planSlots`, so a flexible date is covered by its week slot. For a week slot, the next planned date is the next active day inside it |
| 2 | `src/modules/today/domain/assembleDay.ts`, `assembleDay.test.ts` | Slot mapping carries `week`/`target_days`. The test that pinned the old flexible behaviour is rewritten to the right answer, as written |
| 3 | `src/modules/objectives/domain/validateObjectiveWrite.ts` *(new)* (+ test) | Pure. Returns 400 errors or a 422 mode mismatch, or a normalised write with `end_date = starts_on + runs_for_days − 1`. Also refuses a schedule that plans **no day in the run** (400) and a non-null `from_parked_idea_id` (400, parked ideas do not exist yet) |
| 4 | `src/modules/effort/domain/adherence.ts` (+ test) | The stub is replaced by `figures(slots, dailyMinutes)`, implementing `docs/domain/adherence.md`. It returns `Figures`: required fields plus `planned_days`, `planned_days_worked`, `target_met_days`, `extra_off_day_minutes` |
| 4 | `docs/domain/adherence.md` *(new)* | The adherence and figures rule (decision 4), in the same commit as the code |
| 5 | `src/modules/objectives/domain/scheduleGrid.ts` *(new)* (+ test) | `scheduleGrid(segments, slots, dailyMinutes, from, to)` returns `ScheduleDay[]`. Each day is in exactly one state, as `docs/domain/day-states.md` defines, and carries its `segment_id`. The range is clamped to the objective's span |
| 5 | `docs/domain/day-states.md` *(new)* | The five day states for fixed and flexible schedules (decision 3), in the same commit as the code |
| 5 | `src/modules/objectives/domain/assembleObjective.ts` *(new)* (+ test) | Turns rows into `ObjectiveSummary` / `Objective`: status from `currentStatus` (`created`/`resumed` → active), schedule and label from the segment in force, `start_date` / `end_date` / `original_end_date` / `extension_count`, `from_parking_lot`, figures. The status history merges events with `seq > 0` segments as `extended` rows, by date. No events → `malformed` result. `next_review_on`, `committed_minutes_per_week` and `criteria_verdict` are omitted |
| 5 | `src/modules/objectives/domain/rows.ts` *(new, type-only)*, `vitest.config.ts` | The row shape the repo returns. Excluded from coverage **by name**, per ADR-007's W5-06 amendment |
| 5 | `src/shared/contract.ts` | `ObjectiveWrite`, `ObjectiveSummary`, `Objective`, `PlanSegment`, `StatusEvent`, `Figures`, `ScheduleDay`, `ScheduleGrid`. `PlanSlot` already allows `week` |
| 6 | `src/shared/db.ts` | `withTransaction(fn)`: one client, BEGIN / COMMIT / ROLLBACK. No SQL rules in it |
| 6 | `src/modules/objectives/repo.ts` *(new)* | `insertObjective(tx, …)` writes the objective, segment 0 (`reason = why_now`) and the `created` event (`occurred_on = starts_on`). `getObjectiveRows(userId, objectiveId?)` is **one query** returning objectives + segments + events + per-day minute sums, every CTE filtered by `user_id` |
| 6 | `src/modules/objectives/service.ts` *(new)* | `createObjective`, `listObjectives(status)`, `getObjective(id)`, `getObjectiveSchedule(id, from, to)`. Each read is one repo call |
| 7 | `src/app/objectives/route.ts` *(new)* | `GET` (status filter) and `POST` |
| 7 | `src/app/objectives/[objectiveId]/route.ts`, `…/schedule/route.ts` *(new)* | `GET`. A bad UUID or another user's row → 404 |
| 7 | `src/shared/http.ts` | `isUuid`, shared by the new routes. The effort route is left as it is |
| 7 | `docs/keel-api.yaml` | **Same commit as the routes:**<br>· `tz` description: validated, not stored<br>· `listObjectives` gains `400` (bad `status`)<br>· the three objective reads gain `500` (malformed record: no status events, invariant 16)<br>· `ObjectiveWrite.from_parked_idea_id`: today it is `[string, null]` with no constraint, so a client would believe it works. It gains a description: a non-null value is refused with `400` until parked ideas exist |
| 8 | `src/modules/objectives/objectives.itest.ts` *(new)* | The intent's check, end to end, through the route handlers (CI only) |

## Order of work

Each step is a commit that leaves `main` deployable.

1. **Flexible week slots and status-filtered slots** (`generateSlots`, `planSlots`). Pure,
   and nothing calls the new paths yet.
2. **Close the flexible-on-Today gap.** `coveringSlot` / `nextPlannedDate` move onto
   `planSlots`, and their own `statusOn` checks are removed. Flexible behaviour changes
   on purpose. Fixed behaviour, paused stretches included, must not change at all (see
   Risks).
3. **Write validation** (`validateObjectiveWrite`).
4. **Figures**: `docs/domain/adherence.md` is written, and the real rule replaces the stub, in one commit.
5. **The grid and the assembler** (`scheduleGrid`, `assembleObjective`, `rows.ts`, the
   contract types), with `docs/domain/day-states.md` in the same commit.
6. **Persistence**: `withTransaction`, `repo.ts`, `service.ts`. These are callable but not routed.
7. **Routes and contract edits**, together in one commit. The endpoints go live here.
8. **Integration tests**: the intent's verification as one suite.

## Risks

- **Riskiest step: 2, and the objectives at risk are fixed, paused ones.**
  `coveringSlot` does its own pause suppression today: `statusOn` at
  `coveringSlot.ts:38` refuses a date that isn't active, and at `:68` it skips an
  inactive slot in `nextPlannedDate`. Step 2 removes both checks and relies on
  `planSlots` instead. If `planSlots` suppresses even slightly differently (the day a
  pause starts, the day of a resume, a same-day pause and resume), a fixed objective
  that was paused would:
  - get a slot back on a paused day on Today;
  - have entries logged while paused lose their `extra` flag;
  - get a next planned date that falls inside the pause.
  Flexible objectives are not the risk: none exist until step 7.
  - Mitigation, in this order:
    1. **Before** removing the checks, an equivalence test: for fixed segments and a set
       of pause timelines (pause and resume on a planned day, on an off day, on the same
       day, a pause with no resume, two pauses), the old and new `coveringSlot` and
       `nextPlannedDate` agree on every date across the run.
    2. Every existing paused case must pass unchanged: `coveringSlot.test.ts` (paused,
       resumes), `assembleDay.test.ts` (inside a past paused stretch),
       `computed-slot.itest.ts` (stops planning while paused) and
       `create-effort.itest.ts`.
    3. The only test that changes is the one pinning the old flexible behaviour, which
       was written to fail once that behaviour was fixed.
- **The read query (step 6)** is new SQL that every read depends on. If it drops the
  `user_id` filter in one CTE, it leaks another user's segments or entries (NFR-10).
  Nothing in the schema catches this, because `plan_segment`, `status_event` and
  `effort_entry` carry no `user_id`.
  - Mitigation: an itest with a second user whose objective must 404 and must never
    appear in a list.
- **Transaction (step 6).** A partial write leaves an objective with no `created` event,
  and every later read of the list fails. That failure is deliberate, but it would be
  caused by our own bug.
  - Mitigation: an itest that forces the third insert to fail and asserts no rows remain.
- **One malformed objective fails the whole list** (`500`). The record is the product,
  and showing it with a guessed status is worse. Expect this if old data ever lacks a
  `created` event.
- **Itests accumulate rows.** Nothing is deleted (NFR-01), and `test:integration:tz` runs
  the suite four times against one database. Assertions filter by the ids the test
  created and never count globally. Existing suites `.find()` the seed objective, so
  extra objectives don't disturb them.
- **The fixed adherence formula changes the past.** ADR-008 accepted that cost, and
  nothing displays adherence yet.
- **What could break that isn't ours:** Today's response for flexible objectives (fixed,
  deliberately) and the coverage gate. All new domain code must reach 100%.
- **Not chosen:**
  - Storing `tz`: decision 2.
  - A per-row query for figures or the grid: NFR-03, so one read serves the list, the detail and the grid.
  - A `planSummary` / New-objective preview: out of scope.
  - Accepting `from_parked_idea_id`: there is no `parked_idea` table to check it against, so it gets a 400 rather than an unverifiable reference.
  - Refactoring the effort route onto `isUuid`.
  - `next_review_on`, `committed_minutes_per_week`, `criteria_verdict`: their rules are not in this intent.
- **Found, not in this intent:** none yet. Anything found while building goes to
  `docs/intents/TRIAGE.md`.

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | Unit tests for week slots:<br>· a whole-week run<br>· a short final week (`target_days` ≤ its days)<br>· a one-day flexible run<br>· a month boundary<br>· pause and resume inside a week<br>· invariant 9 (no two slots cover a day)<br>Fixed cases unchanged | No caller |
| 2 | The fixed-paused equivalence test, written and passing **before** the `statusOn` checks are removed. Unit tests: a flexible date covered by its week, a paused flexible week, next planned date inside a week. Every existing paused fixed test is unchanged; `test:tz` passes in four zones | Fixed behaviour is proven unchanged, paused stretches included. Flexible behaviour moves, and no flexible rows exist yet |
| 3 | Unit tests: each 400 field, both 422 mismatches, a bad zone, `runs_for_days` 1 and 365, a schedule with no planned day in the run, a non-null parked idea | No caller |
| 4 | Unit tests for each edge case `docs/domain/adherence.md` names, at least: zero slots, zero entries, logged over target (capped), off-day minutes excluded from adherence, a flexible week, a paused stretch | No caller (the stub had none) |
| 5 | Unit tests:<br>· each edge case `docs/domain/day-states.md` names<br>· all five states, including `off_day_worked`, for fixed and flexible<br>· a day across a segment boundary naming the right `segment_id`<br>· `from`/`to` clamping<br>· the history merge with a `seq 1` segment<br>· `created`/`resumed` → active<br>· no events → malformed<br>Coverage gate at 100% | No caller |
| 6 | Itest: a create writes all three rows. A forced failure of the third write leaves none | Not routed |
| 7 | `npm run contract`; build. Itest through the handlers: 201, 400 (field), 422 (mismatch), 404 (other user, bad UUID), 400 (bad `status`, `to` < `from`) | Endpoints are new; nothing existing changes |
| 8 | **The intent's check:**<br>· create one fixed and one flexible objective (weekly and monthly cadence)<br>· the list returns both, active, with schedule and figures (0 of a real target)<br>· opening one returns segments and history<br>· log effort on one planned day and one off day<br>· the grid shows `target_met` or `worked_short`, `off_day_worked`, `planned_no_log` and `off_day`<br>One-read proof: `query` is spied, and each read makes exactly one call with three objectives present | Tests only |

The local checks run on every step: `format:check`, `lint`, `typecheck`, `test:tz`,
`test:coverage`, `contract`, `build` and `commitlint`. Integration tests run in CI.
Commits carry `Intent: I-01`.
