# Plan — I-15 · Pause, resume, terminate; notes

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-11-03 · **Written:** 2026-11-03

## Context

An objective's Overview shows its status banner, notes, status history and footer,
but nothing on it can change them. The footer's words carry the comment "its actions
come with a later intent" (`footerLine`, `objectiveView.ts`). The API already does
everything this intent needs:

- `POST /status-changes` appends a `paused`, `resumed` or `ended` event under the
  objective lock. It checks the event against the history (`statusChange.ts`) and
  answers 409 when the change doesn't follow, or when it's dated before the latest one.
- `planSlots` drops every slot day the objective wasn't active, so a pause dated
  today removes today's slot, and today's time becomes extra.
- `dueWindows` surfaces nothing while the objective is paused, so reviews wait.
- `POST /notes` appends a note in any state (G2). Notes come back inside `Objective`.
  There is no `GET /notes`; the spec's "GET/POST" is the objective read plus the POST.
- G12: the UI requires the reason. The contract leaves it optional.

So this is a UI intent, with one exception, decided while this plan was written
(Rohit, 2026-11-03).

- **A final review that never falls due.** Pause an objective before its last review
  window starts, and resume it after the end date. Its `plan_end` window then has no
  planned day, and `dueWindows` skips every window with no planned day
  (`review-windows.md`). The final review never becomes due, and the objective sits
  Active and plan-ended with only Terminate. The spec says "Resumed after the plan's
  end date, the final review is due at once". So a closed, unsaved `plan_end` window
  becomes due while the objective is active, planned days or not. This changes a
  domain rule, so step 1 amends `review-windows.md` before the plan is accepted. The
  contract doesn't change.

## What the code has today, and what changes

| Today | Where | Becomes |
|---|---|---|
| A window with no planned day is never due, `plan_end` included | `dueWindows`, `upcomingReviewOn` (`reviewWindows.ts`) | A closed, unsaved `plan_end` window is due while active, with or without planned days. Every other window keeps the rule |
| The footer is words only, by status | `footerLine(status)` (`objectiveView.ts`) | `footer(o, today)`: the line and the actions, from the design's four states, including "Active, plan ended" (Terminate only) |
| "Resumed" shows the reason, which a resume never has | `eventRow` (`objectiveView.ts`) | "Resumed. Still planned till Mon 21 Sep.", or, after the end, "Resumed after the plan ended Fri 4 Sep." |
| The Paused banner has no Resume | `banner` / `Overview` (`ObjectiveDetail.tsx`) | **Resume** on it |
| Notes list only | `Overview` | **+ Add a note** and the inline box |

**Reused, not copied:**
- **The dialog:** `Dialog` (`(app)/Dialog.tsx`: native modal, focus in and back, `busy` holds it open), `dialog.module.css` parts, and the shake.
- **Fields:** `FieldError`, `CountedLabel`, `errorIdOf`, `describedBy` (`(app)/form.tsx`).
- **The send:** LogDeviation's `sending` ref and `release()` pattern, and Today's `refresh` inside `startTransition` so the page stays until the new one arrives.
- **Words:** `dayLabel`, `duration` (`objectiveView.ts`, `newObjective.ts`); `useToast` (`app/toast.tsx`).
- **The day:** `localDayOf(new Date(), tz)` (`shared/time/localDay.ts`), with the user's zone the page already has.

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/domain/review-windows.md` | The `plan_end` due exception, in *Which window is due* and *The next review*, and two rows in the worked examples |
| 2 | `docs/intents/I-15-status-and-notes/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 3 | `reviews/domain/reviewWindows.ts` (+ test); `objectives/status-change.itest.ts` | The exception in `dueWindows` and `upcomingReviewOn` |
| 4 | `objectives/domain/statusActions.ts` *(new, + test)*; `objectives/domain/objectiveView.ts` (+ test) | The pure rules and words below. `footer` replaces `footerLine`; the Resumed line |
| 5 | `objectives/Notes.tsx` *(new)*; `ObjectiveDetail.tsx`; `objectives.module.css` | + Add a note |
| 6 | `objectives/Resume.tsx` *(new)*; `ObjectiveDetail.tsx`; `objectives.module.css` | Resume on the Paused banner |
| 7 | `objectives/ReasonDialog.tsx` *(new)*; `ObjectiveDetail.tsx`; `objectives.module.css` | The footer's Pause and Terminate, and their dialogs |
| 8 | `docs/intents/TRIAGE.md` | The findings below |

Paths in `objectives/domain/…` and `reviews/…` are under `src/modules/`. The `.tsx` and
`.css` paths are under `src/app/(app)/objectives/`.

### The pure rules (step 4): `objectives/domain/statusActions.ts`

- **The footer:** `footer(o, today)` gives `{ line, pause, terminate }`.
  - Active, not ended: the design's Active line, Pause and Terminate. This covers running and not started.
  - Active with `end_date < today`: "The plan has ended. The final review decides what happens next.", Terminate only.
  - Paused: its line and Terminate.
  - Completed or ended: the final line and no actions.
- **Pause:** `pauseDialog(o, today)` gives the title, the body with `end_date`, the label "Why are you pausing?", the hint, and the button **Pause it**. `loggedToday(minutes)` gives "Today stops being planned. The 1h 20m logged today stays, as extra.", or null at 0.
- **Terminate:** `terminateDialog` gives the title, the body, the label "Why are you terminating it?" and the red **Terminate**.
- **The reason:** `checkReason(kind, text)` returns the design's error for a blank reason: "Write why you are pausing it." or "Write why you are terminating it.". Both reasons are capped at 280.
- **The bodies:** `statusBody(change, reason, day)` gives `{ change, occurred_on, reason }`. The reason is sent as typed.
- **Toasts:**
  - `pausedToast(o)`: "Paused. The end date stays Mon 21 Sep.";
  - `TERMINATED`: "Terminated. Everything recorded is kept.";
  - `resumedToast(o, reviews, today)`: "Resumed. It is back on Today.", or "Resumed. Its plan has ended, so the final review is due." when `end_date < today` and no `plan_end` review for it is saved.
- **Failures:**
  - `NOT_CHANGED(kind)`: "Couldn't pause it. Nothing was changed. Try again." (also resume, terminate);
  - `CHANGED_ELSEWHERE`, for a 409: "This objective changed somewhere else. Nothing was changed here.";
  - `NOTE_NOT_SAVED`: "Couldn't save the note. Nothing was saved. Try again.".
- **Notes:** `NOTE_MAX = 120`; `noteBody(text, day)`; `NOTE_SAVED` "Note saved."; `NOTE_LINE` "Once saved, a note can't be edited or deleted.".
- **`objectiveView.ts`:** `eventRow`'s `resumed` uses `endAsOf(o.segments, date)`: the end of the plan as it stood that day, not after a later extension. Then:
  - on or before that end: "Resumed. Still planned till {end}.";
  - after it: "Resumed after the plan ended {end}.".

---

## Order of work

1. **Amend the due rule.** Docs only. Rohit accepts the change before step 2. `review-windows.md` says:
   - a closed, unsaved `plan_end` window is due while the objective is active, even with no planned day. A plan can end only through its final review, and a pause doesn't change that;
   - `upcoming_review_on` doesn't skip it;
   - every other window keeps the zero-planned-day skip.

   Examples: paused through the last window and resumed after the end, so the final review is due on resume; paused through a middle week, which is still never due.
2. **Accept the plan.** `plan.md` committed alone.
3. **The due rule.** `dueWindows` and `upcomingReviewOn` exempt `kind === "plan_end"` from the planned-day test. Both readers get it: `assembleObjective` for the list and the Overview, and `reviews/service.ts` and `assembleReview` for the tab and `POST /reviews`. An earlier segment's `plan_end` is always saved, since its extension needed it (invariant 7), so only the last one can be affected.
4. **The pure rules,** at 100 % (ADR-007). `footer` replaces `footerLine`, and the Overview renders `footer(o, today).line` with no buttons yet. That makes the "Active, plan ended" words live, which is right with no actions. The Resumed line is live too.
5. **Notes.** `Notes` takes over the Overview's Notes block:
   - **+ Add a note** opens the inline box: a textarea with the counter and the line, then **Cancel** and **Save note**;
   - **Enter** saves, **Shift+Enter** adds a line, and **Esc** cancels;
   - `POST /notes` is sent with `written_on = localDayOf(new Date(), tz)`;
   - **on 201:** the note shows at once from the response. The box closes, the toast says "Note saved.", focus returns to **+ Add a note**, and the page refreshes in a transition;
   - **on failure:** the text stays and `NOTE_NOT_SAVED` shows. A `sending` ref sends once. A blank note sends nothing.
   - Open in every status.
6. **Resume.** It's a button on the Paused banner, with no dialog:
   - the `sending` ref, then `POST /status-changes` with `resume` and today in the zone;
   - **on 201:** `resumedToast`, then `router.replace('/objectives/{id}')` in a transition, so the list moves to Active;
   - **on failure:** `NOT_CHANGED("resume")` under the button. A 409 gives `CHANGED_ELSEWHERE` and a refresh.
   - Resume comes before Pause, so that in this commit only an objective paused through the API shows it, and no UI pause is left without a way back.
7. **Pause and Terminate.** The footer renders `footer(o, today)`'s actions.
   - `ReasonDialog` is shared: the title and body, the reason field with its counter, error and hint, and **Cancel** and the action.
   - **Pause:** when the dialog opens and `o.last_logged_on === today`, it reads `GET /effort-entries?from=today&to=today` and sums `minutes` for `loggedToday`. If the read fails, the line is left out.
   - **Send:** `checkReason` runs first (error, shake, focus on the field). Then the `sending` ref and `POST /status-changes`.
   - **On 201:** clear every hold, close, show the toast, then `router.replace('/objectives/{id}')` in a transition, so the list shows it under Paused or Terminated.
   - **On failure:** the dialog stays with the reason, and `NOT_CHANGED` or `CHANGED_ELSEWHERE` shows.
   - `busy` is held once, in the dialog's owner, and passed down (Common mistakes: the Log time `busy`).
8. **TRIAGE.**
9. **Proof** on localhost. The intent's check runs on the deployed service after the merge.

No new dependency, no migration, no infra, no contract change.

---

## Risks

**What could break**

- **Which reviews are due (step 3).** `dueWindows` feeds the list's due pill, the Overview banner, the Reviews tab and `POST /reviews`. A wrong exception would make reviews due that shouldn't be, or skip ones that should be.
- **A final review appears on a live objective (step 3).** Any active objective whose `plan_end` window is closed with no planned day gets its final review due at once. For example, a Mon-only plan whose last window holds no Monday. Today that objective is stuck. This is the intended fix, but the user will see it appear.
- **Two sends (steps 5–7).** A double click, or Enter after a click, could pause twice. The second would be a 409, but would read as a failure.
- **A flag held in two components (step 7).** If the dialog kept `busy` after a save, the next dialog would open stuck (Common mistakes).
- **The wrong day (steps 5–7).** A page left open overnight would date a pause yesterday if it used the page's `today`. A pause dated before the latest event is a 409.
- **The list after a change (steps 6–7).** A refresh at `/objectives?status=active` would open the next active objective, not the one just paused.
- **Today's figures move on pause (step 7).** Today's slot goes, so today's time becomes extra and so-far adherence can change. That is the design, but it could read as a bug.
- **Pausing every objective (step 7).** Today then shows the new-account card. This is already in TRIAGE (found in I-08), and the UI now makes it easy to reach.
- **History reads the wrong end (step 4).** Reading `o.end_date` for an old Resumed line would show an extension's end that didn't exist yet.

**How each risk is handled**

| Risk | Handling | Prevented by | Proved by |
|---|---|---|---|
| Due reviews shift | Prevented | The exception is only `kind === "plan_end"`, closed, unsaved and active; every other window is unchanged | `reviewWindows.test`: all existing cases unchanged; paused middle week still not due; zero-day `plan_end` due; `upcomingReviewOn` the same |
| A final review appears | Accepted | It is the rule step 1 states; it was unreachable before | `reviewWindows.test`: the Mon-only case |
| Two sends | Prevented | A `sending` ref checked before anything, cleared on every way out | Chrome: double click and Enter-spam send one request (Network panel) |
| Flag in two places | Prevented | `busy` lives once, in the dialog's owner | Chrome: save, then open the other dialog; × and Esc work |
| Wrong day | Prevented | The day is `localDayOf(new Date(), tz)` at send time, the user's zone | `statusActions.test` builds the body from a given day; Chrome |
| List opens another objective | Prevented | `router.replace('/objectives/{id}')`, which selects it under its new status | Chrome from `/objectives` and from `/objectives/{id}` |
| Figures move on pause | Accepted | The design says today stops being planned; the dialog says so first | Chrome: time logged, pause, the line and then the figures |
| All paused, new-account card | Accepted | In TRIAGE since I-08; not this intent | — |
| Wrong end in history | Prevented | `endAsOf`: the end of the last segment that was planning before that day | `objectiveView.test`: resumed, then extended later, keeps the old end |

**The riskiest step: 3.** It's the only server change, and it changes a rule that
five readers share. The mitigations:
- The exception is one `kind` check inside the existing predicate, so nothing else in the rule moves.
- Every existing `reviewWindows` and itest case must pass unchanged.
- `status-change.itest.ts` makes the stuck case through the API and checks two things: `GET /reviews` lists the `plan_end` as due, and `POST /reviews` starts it.

**What was not chosen**

- **Requiring the reason on the server (G12).** The spec keeps the contract as it is.
- **Moving the end date on pause, or completing outside the final review.** Both are out of scope.
- **Optimistic status changes.** The page waits for the server's answer, because the banner, footer, figures and list all follow from it.
- **A GET for today's minutes on every Overview.** The entries are read only when the Pause dialog opens, and only if something was logged today.
- **One dialog per action.** Pause and Terminate share `ReasonDialog`; only the words differ.

**Decided, not specified** (for the PR)

- **Terminate's reason** is capped at 280, like Pause. The design gives no number.
- **A blank reason** (spaces only) is refused with the design's error. The reason is sent as typed.
- **A blank note** sends nothing. The design has no error for it.
- **Failure words:** "Couldn't pause it. Nothing was changed. Try again." (also resume and terminate), and "This objective changed somewhere else. Nothing was changed here." on a 409.
- **The logged-today line** is left out when today's entries can't be read.
- **The Resumed history line** after the end reads "Resumed after the plan ended Fri 4 Sep."
- **The final-review toast** shows only when `end_date < today`. On the last day itself the due banner says it.

---

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1, 2 | `npm run contract` | Docs only |
| 3 | `reviewWindows.test` under `test:tz`: the zero-day `plan_end` due while active, not while paused, not once saved; middle windows unchanged; `upcomingReviewOn`. `status-change.itest.ts` (CI): pause before the last window, resume after the end, final review due and startable | Every window with a planned day is decided as before |
| 4 | `statusActions.test.ts` at 100 %: each footer state, including not started and plan ended; both dialogs' words; `loggedToday` at 0 and 80; `checkReason` blank, spaces and 280; bodies; each toast, the final-review one with and without a saved `plan_end`. `objectiveView.test`: the Resumed line in and after the plan, and after a later extension | Words only; no new action |
| 5 | Chrome at 1280 and 767 px: add a note on an active and on a terminated objective; newest first, dated today; Enter, Shift+Enter, Esc; 120 cap and counter; blocked request keeps the text; double Enter sends once; keyboard only | Notes are open in every state; the API already allows it |
| 6 | Chrome: Resume an objective paused through the API; toast; back on Today; history "Resumed. Still planned till …"; resumed after the end: the other toast and the final review due; blocked request | Shows only on objectives paused through the API |
| 7 | Chrome: Pause from a running and a not-started objective; no Pause once the plan has ended; the required error and shake; the logged-today line; list under Paused, off Today, reviews and due banner hidden, end date unchanged; Terminate from active, paused and plan-ended; Terminated banner and final footer; double click sends once; blocked request keeps the reason; then the other dialog opens and closes normally; phone bottom sheet; keyboard only | — |
| 8 | — | Docs only |
| 9 | After the release, the intent's check on the deployed service | — |

**Test data:** objectives are made through the API on a local account, as in I-14,
with a start date in the past where the plan must have ended. One is paused through
the API, for step 6. One is paused before its last week, to resume after the end. One
is Mon-only, for the zero-day `plan_end`. Failures are made by blocking
`POST /status-changes` and `POST /notes` in Chrome.

**TRIAGE (step 8):**
- `POST /status-changes` accepts an `occurred_on` in the future. Notes refuse one (422), and status changes should too.
- `POST /status-changes` accepts `complete`, which completes an objective without its final review. That breaks the rule that only the final review completes one. Removing `complete` is a contract change.
