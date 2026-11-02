# Plan — I-12 · Deviations, and Log a deviation

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-11-02 · **Written:** 2026-10-31

## Context

The API records deviations, but nothing on screen does. `/deviations` says "This screen
isn't built yet". Today's rail has no deviation parts. An objective has no Deviations
tab. This intent builds the design's dialog, page, rail parts and tab
(`06-deviations.md`, `03-today.md`, `04-objectives.md`, `01-shell.md`, G32–G36, G46)
from the API as it stands. There is no API or contract change.

## What the code has today, and what changes

| Today | Where | Becomes |
|---|---|---|
| A placeholder page | `src/app/(app)/deviations/page.tsx` | This week's list and detail, with the filter, the week box and the empty week |
| No deviation detail address | — | `/deviations/[id]`: on desktop the list with the detail beside it, on phone the detail alone with **‹ Deviations**. `?recorded=1` flashes the row once |
| `GET`/`POST /v1/deviations` and `/v1/deviation-patterns` exist, and nothing on screen calls them | `src/app/v1/deviations/`, `…/deviation-patterns/` | Read and written as they are, never changed |
| `Day.last_deviation` is returned, and nothing shows it | `modules/today/domain/assembleDay.ts` | Today's rail: **Log a deviation**, then the **Last deviation** card |
| Today has `L` | `(today)/Today.tsx` | And `D` |
| Objectives' list-and-detail layout (columns, filter, selected row, ‹ Back, the phone's one-or-the-other, the flash) and its flash-once logic | `objectives/objectives.module.css`, `ObjectiveList.tsx` | Shared: `src/app/(app)/listDetail.module.css` and `useFlashOnce.ts`. Objectives and Deviations both use them; Objectives looks and works as before |
| The detail has Overview and Effort tabs. So far has three tiles | `objectives/ObjectiveDetail.tsx`, `objectiveView.soFar` | A **Deviations n** tab. So far gains **Deviation time** |

**Reused, not copied:**
- **Dates and durations:** `dayLabel` and `duration` (`newObjective.ts`); `total` and `compact` (`todayView.ts`); `mondayOf` (`effort/domain/effortMonth.ts`).
- **Choices for a day:** `loggable` (`todayView.ts`): `start_date ≤ date ≤ end_date` over active objectives. This is the API's 422 rule (`deviationRefusal`: active, with a plan covering the date). It's the same rule Log time's chips use (G44).
- **Screen parts:** `Dialog` (with `wide`) and `dialogParts`; `CountedLabel`, `FieldError`, `describedBy`; `useToast`; `useShortcut`; `PageHeader` and `KeyHint`; `readApi`; `requireUser`; `todayFor` (`objectives/today.ts`), the API's today in the user's zone.
- **The send-once pattern:** Log time's `sending` ref, and its rule to clear `busy` on every way out (Common mistakes).
- **The list and detail:** the layout and flash moved out of Objectives in step 3. The shape of `objectives/Screen.tsx` (one component, `show="list" | "detail"`) is followed, not shared: the rows and filters differ.

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/intents/I-12-deviations/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 2 | `src/modules/deviations/domain/deviationView.ts` *(new, + test)*; `logDeviation.ts` *(new, + test)* | The pure rules, below. Unused yet |
| 3 | `src/app/(app)/listDetail.module.css` *(new)*, `useFlashOnce.ts` *(new)*; `objectives/objectives.module.css`, `ObjectiveList.tsx`, `Screen.tsx`, `ObjectiveDetail.tsx` | The list-and-detail layout and the flash-once logic move out of Objectives, unchanged. Objectives uses them, with no visible change |
| 4 | `src/app/(app)/deviations/page.tsx`, `[id]/page.tsx` *(new)*, `Screen.tsx`, `DeviationList.tsx`, `DeviationDetail.tsx`, `DeviationsHeader.tsx`, `deviations.module.css` *(new, for its own parts only)* | The Deviations page, read-only, on the shared layout: header, filter, week box, list, detail, empty week, desktop and phone. The header's button is there but does nothing yet |
| 5 | `src/app/(app)/LogDeviation.tsx`, `logDeviation.module.css` *(new)*; `deviations/DeviationsHeader.tsx`, `DeviationList.tsx` | The dialog, opened from the header, the empty week and `D` on Deviations. After a deviation is recorded: the page, the new row selected and flashing, and the toast |
| 6 | `(today)/Today.tsx`, `today.module.css` | Today's rail: **Log a deviation** and the **Last deviation** card, and `D` |
| 7 | `objectives/page.tsx`, `[id]/page.tsx`, `Screen.tsx`, `ObjectiveDetail.tsx`, `DeviationsTab.tsx` *(new)*, `DeviationWeekDialog.tsx` *(new)*, `objectives.module.css`; `modules/objectives/domain/objectiveView.ts` (+ test) | The objective's Deviations tab, with its count in the label and the week dialog. So far gets Deviation time |
| 8 | `docs/intents/TRIAGE.md` | The findings below that fall outside this intent |

### The pure rules

**`deviations/domain/deviationView.ts`** (every place that shows a deviation)
- **The week:** `thisWeek(today)`: Monday to Sunday around the API's today, for the page's read and its eyebrow, "This week · 31 Aug – 6 Sep".
- **The page:**
  - `filters(list, cost)`: All · Chosen · Drifted. The counts are `cost.chosen.count` and `cost.drifted.count`; All is their sum.
  - `inFilter(list, filter)` keeps the API's order, newest first.
  - `weekBox(cost)`: "Off plan this week 6h 15m · Chosen 5h 00m · Drifted 1h 15m", from `cost` alone.
- **A row,** `row(d, names, today)`: "Wed 2 Sep · Python and DSA", the kind pill, what happened, "5h 00m". A deviation naming several objectives reads "Python and DSA, Writing".
- **The detail,** `detail(d, names, patterns, today)`:
  - the three tiles: **Time off plan**, **Pulled from** (every name), **When**;
  - the reasoning block (Chosen), or the pattern block (Drifted): the name, "3rd time" from `pattern_nth`, and the description from the pattern list. None of these reads "A one-off · no pattern";
  - **What you did instead** when given;
  - the verdict footer. Without a verdict: the design's two lines, dated by `review_due_on`; with `review_due_on` null, "Not reviewed yet." alone. With a verdict: "Worth it" or "Not worth it, at review".
- **Today's card,** `lastCard(d, today)`: the pill, what happened, "4 Sep · 45m · Research spiral", and `openable` when `local_date ≥ thisWeek(today).from`.
- **An objective's tab:**
  - `tabSummary(cost, n)`: "2 deviations · 6h 15m off plan · Chosen 5h 00m · Drifted 1h 15m";
  - `mostRecent(list, today)`: the card, with **Open in Deviations** when it's this week;
  - `byWeek(o.weeks, list, today)`: the plan weeks that have begun, each with its count and minutes;
  - `deviationWeek(week, n, list, today)`: "Deviations · Week 2", "Sun 30 Aug – Sat 5 Sep · 1 deviation · 5h 00m off plan", the day chips, and one block per day up to today, or "No deviations.".
- **So far's tile,** `deviationTile(cost)`: "6h 15m", hint "2 deviations" (or "1 deviation", or "0m" with "No deviations").

**`deviations/domain/logDeviation.ts`** (the dialog)
- **Limits:** what happened 120, reasoning 280, pattern name 40, its description 120, did instead 120. These are shorter than the contract's 2000.
- `weekChips(today)`: Mon … Sun of this week, each with its date and `disabled` when after today, plus the title "Hasn't happened yet".
- `choicesFor(objectives, date)`: active objectives that `loggable` keeps for that date, as chips with the title.
- `fitMinutes(typed)`: digits only, four at most.
- `checkDeviation(draft, { today, patterns, choices })`: every error in the design's words, in field order, with the first one to focus. It covers:
  - Chosen or Drifted;
  - the objective, which must still be a choice for the day;
  - what happened, after trimming;
  - the reasoning, for Chosen only;
  - the pattern, for Drifted only;
  - the new name, which must not match an existing name after trimming, ignoring case, as the database's `lower(name)` index does;
  - minutes, from 1 to 1440;
  - the day, which can't be after today.

  It returns the pattern body, if there is one, and the deviation body with `objective_ids: [id]`, `local_date`, `tz` and `pattern_id`.
- The words: `TOAST = "Deviation recorded."`, and `NOT_RECORDED = "Couldn't record it. Nothing was recorded. Try again."`.

---

## Order of work

1. **Accept the plan.** `plan.md` committed alone.
2. **The pure rules**, at 100 % coverage (ADR-007). Unused yet.
3. **The shared list and detail.** A move, not a rewrite:
   - into `listDetail.module.css`: the two columns (`.wrap`, `.listHead`, `.list`, `.detailCol`); the filter's segmented control with counts, and its pills on phone; the row frame with its hover, selected ring and focus; the empty-filter line; `.back`; the flash and its keyframes under reduced motion; and the 860 px rule that shows one or the other (`.showList`, `.showDetail`);
   - into `useFlashOnce(flash, selected)`: the flashing id kept in state, and the `router.replace` that drops the parameter. `ObjectiveList` calls it with `?created`, Deviations will call it with `?recorded`;
   - `objectives.module.css` keeps only what is Objectives' own: the row's lines, progress bar and pills, the detail, the tabs, the tiles.

   The class names and values stay as they are, so the move can be checked by eye.
4. **The Deviations page, read-only.** It replaces the placeholder. It makes three reads in parallel on the server:
   - `/deviations?from&to` for this week;
   - `/objectives?status=all`, for names and, later, the dialog's choices;
   - `/deviation-patterns`, for descriptions.

   The filter is `?kind=`. `/deviations/[id]` finds the id in this week's list, and goes to `/deviations` when it isn't there.
5. **Log a deviation on the Deviations page.** The dialog reads `/v1/deviation-patterns` when it opens, so it never shows a stale list. On submit:
   - check everything (`checkDeviation`), and send nothing if a check fails;
   - for a new pattern, `POST /v1/deviation-patterns`. A 409 shows the duplicate-name error and reads the list again;
   - `POST /v1/deviations`;
   - on 201: `router.push('/deviations/{id}?recorded=1')`, then the toast. The row flashes once, then `router.replace` drops `?recorded`.

   On failure, everything typed stays and the banner says nothing was recorded. If the pattern was made and the deviation failed, the field now picks that pattern, so a retry doesn't create it again (G36).
6. **Today's rail.** **Log a deviation** (red tint, full width) above Adherence, and the **Last deviation** card from `day.last_deviation` under it. The dialog's choices are `day.objectives`, which is every active objective with its `start_date` and `end_date`. `D` works like `L`, only when Today has objectives. Today makes no new read: patterns are read only when the dialog opens.
7. **The objective's Deviations tab.** Both objective pages read `/deviations?objective_id={id}&from={start_date}&to={end_date}` for the open objective. Every deviation falls inside its plan, by the 422 rule. Then:
   - the label reads "Deviations 2";
   - So far gets Deviation time;
   - the tab and its week dialog use the same read, so nothing more is read when the tab opens.

   If the read fails: the label reads "Deviations", the tab shows "Couldn't load deviations. Try again.", and So far leaves the tile out rather than show a 0.
8. **TRIAGE.**
9. **Proof** on localhost. The intent's check runs on the deployed service after the merge.

No migration, no infra, no dependency, no contract change.

---

## Risks

**What could break**

- **Objectives (step 3).** A live screen whose layout moves files. A rule left behind, or one moved that was Objectives' own, would show as a lost column, a filter without its pill look on phone, a missing selected ring, or a flash that runs on every reload.
- **Today (step 6).** Today is a live screen, and its rail changes. Three things must still hold:
  - one read for the day (NFR-03);
  - `L` and Log time unchanged;
  - the rail's layout at 861–1180 px, where it moves under the cards.
- **A deviation recorded twice, or a pattern made twice (step 5).** There are two writes, and a double click, Enter and a retry all reach them.
- **Figures that disagree.** The same deviations must show the same total on the week box, the filter counts, the objective's summary line, By week and So far's tile, and the rows must add up to those. The week box and summary come from the API's `cost`. By week and the tile only add `minutes` over the list the API returned. That is the spec's one permitted rule.
- **The wrong week or day.** Monday, "today", disabled days and **Open in Deviations** are measured against `todayFor` (the user's zone, as the API counts it), never the browser's clock. The dialog sends `tz` = that zone, as Log time does.
- **A choice the API refuses.** A chip offered for a day must be one the API accepts. `loggable` over active objectives is the server's rule. A status change in another tab is still possible: the API's 422 comes back as the banner, and nothing is recorded.
- **The pattern dropdown.** It's a custom listbox (each option has a name, a description and "3 before"; a native `<select>` can't show that). Its keyboard handling and `aria-activedescendant` are where accessibility can slip. `D` is already ignored inside `role="listbox"` (`shortcuts.ts`).
- **The objective pages (step 7).** They gain one read, made after the objective's because it needs `start_date`. If that read fails, the page must still render.
- **Phone.** The week box becomes 2 × 2. The detail's third tile is hidden. The filter becomes scrolling pills. The dialog becomes a bottom sheet, and it's a long form.

**How each risk is handled**

| Risk | Handling | Prevented by | Proved by |
|---|---|---|---|
| Sent twice | Prevented | A `sending` ref set before the first write, held across both, and cleared on every way out | Chrome: a double click and Enter send one POST of each |
| Pattern orphaned, then made again | Prevented | After a pattern 201, the draft holds its id. A retry sends only the deviation | Chrome: the network cut between the two writes, then a retry |
| Figures disagree | Prevented | `cost` as given; sums over the API's list only | `deviationView.test.ts`; Chrome: one week's totals on the page, the objective tab and So far |
| Wrong week | Prevented | `thisWeek(todayFor)`; tests under three zones | `test:tz` |
| A chip the API refuses | Prevented, mostly | `loggable`, the server's rule; a 422 shows as the banner | `logDeviation.test.ts`; Chrome: a day before an objective's start offers no chip for it |
| Today regresses | Prevented | No new read; the rail adds parts below its header; `L` untouched | Chrome: Today at 1280, 1000 and 767 px; Log time once |
| The objective read fails | Prevented | Its failure is a value (`Read`), not a throw | Chrome with that request blocked |
| Listbox keyboard | Prevented | ↑ ↓ Home End Enter Esc, focus stays on the button, `aria-activedescendant` | Chrome: only the keyboard, with VoiceOver reading an option |
| Objectives changes in step 3 | Prevented | Classes and values moved unchanged; Objectives' own rules stay; one hook replaces the same lines | Chrome on Objectives at 1280 and 767 px, before and after the move: filters, selection, ‹ Objectives, the `?created=1` flash once and not on reload |
| One extra read per objective view | Accepted | The count is in the tab label, so it's needed with the page | — |

**The riskiest step: 5.** It's the only step that writes. It sends two requests with a
rule between them (G36), validates ten fields, and adds the app's first custom listbox.
The rest of the dialog follows the day picked: when **When** changes, a picked objective
the new day can't take is cleared. Mitigations:
- Every check and body is in `logDeviation.ts`, tested at 100 % before the dialog exists.
- The dialog first lands on the Deviations page, which until then was a placeholder, so Today isn't touched before step 6.
- Chrome covers each error, the send-once case, the failure between the two writes, and a new account with no patterns.

**What was not chosen**

- **An API or contract change**, including a "Recorded" date (see Decided).
- **Reading patterns with the page on Today.** It would make Today two reads. The dialog reads them when it opens.
- **A shared list-and-detail React component.** Step 3 shares the layout and the flash, not the markup. The rows, filters and details differ enough that a shared component would be mostly props. Parking lot can use the same CSS and hook.
- **The detail's actions in the design's other places:** **Park an idea**, `P`, and `D` on the Parking lot. They are out of scope.
- **Deviations before this week on the page.** Out of scope. They show on each objective.
- **A loading page for Deviations.** The same choice as I-11.
- **Picking several objectives in the dialog.** G46: one. A deviation with several, sent through the API, still shows on each objective, with every name.

**Decided, not specified** (for the PR)

- **"Recorded 2 Sep"**: `Deviation` has no recorded date, only `local_date`. The detail's head shows the kind pill alone, and the date stays in the **When** tile. The missing date goes to TRIAGE as a contract gap.
- **Addresses:**
  - the filter is `?kind=chosen|drifted`;
  - one deviation is at `/deviations/{id}`;
  - an id outside this week goes to `/deviations`.
- **A verdict once given:** "Worth it" or "Not worth it, at review".
- **No review window covers it** (`review_due_on` null): "Not reviewed yet." alone.
- **Changing When** clears an objective that day can't take.
- **None of these** in the detail reads "A one-off · no pattern".
- **The failure banner:** "Couldn't record it. Nothing was recorded. Try again.". After a pattern was made, the field now picks it.
- **A failed patterns read** shows under **Pattern** and blocks only a drifted record. Chosen can still be recorded.
- **The tab, when its read fails:** "Deviations" with no count, and So far without the tile.

---

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | — | Docs only |
| 2 | `deviationView.test.ts` and `logDeviation.test.ts` at 100 %:<br>• the week around a Monday, a Sunday and mid-week<br>• filters and the week box from `cost`, an empty week<br>• rows and detail for chosen, drifted with a pattern, None of these, several objectives, `did_instead`, a verdict, `review_due_on` null<br>• "1st", "2nd", "3rd", "11th"<br>• the last card in this week and before it<br>• tab summary, most recent, By week over begun weeks, the week dialog's empty days and future days left out<br>• every error message; minutes 0, 1440, 1441, "9a"; a duplicate name in another case; the objective cleared by a day change; both bodies | Unused |
| 3 | Typecheck, build. Chrome on Objectives at 1280 and 767 px, compared with before the move:<br>• each filter, its count, and the phone pills<br>• the selected row's ring; hover and focus<br>• the first objective open on desktop; phone list → detail with **‹ Objectives**<br>• New objective: the row flashes once, and a reload doesn't flash<br>• an empty filter's line | Objectives looks and works as before; nothing else uses the shared files yet |
| 4 | Chrome at `/deviations`, 1280 and 767 px, with deviations recorded through the API:<br>• the eyebrow; each filter and its count; the week box (2 × 2 on phone)<br>• rows newest first; the detail for each kind; the third tile hidden on phone<br>• the empty week<br>• `/deviations/{id}` and a made-up id<br>• phone list → detail with **‹ Deviations** | It replaces a placeholder, and it only reads |
| 5 | Chrome on Deviations:<br>• open from the header, the empty week and `D`; Esc and × close it; focus returns<br>• every error, in the design's words, with the shake and focus<br>• a new account: only **None of these** and **+ Add a new pattern**<br>• one Chosen and one Drifted with a new pattern recorded, each selected, flashing and toasted<br>• a double click sends one of each POST<br>• with the deviation POST blocked: the banner, the pattern now picked, a retry records it<br>• the listbox by keyboard alone | — |
| 6 | Chrome on Today: the rail's button and `D` open the dialog; recording goes to Deviations; back on Today the card shows it, with **Open in Deviations**; one from last week (through the API) shows no link; no card on an account with none; Today's own read count is unchanged; Log time and `L` as before | — |
| 7 | Chrome on an objective with deviations in two weeks:<br>• "Deviations n" with arrow keys<br>• the summary line, Most recent, By week, a week's dialog<br>• So far's tile<br>• the same totals as the Deviations page for this week<br>• one named on two objectives shows on both<br>• the read blocked: the page renders, and the tab says so<br>Plus `objectiveView.test.ts` | — |
| 8 | — | Docs only |
| 9 | After the release, the intent's check on the deployed service | — |

No itest changes, because the API is unchanged.

**Test data:** everything Chrome needs can be made through the API on a local account:
- a deviation dated earlier in the plan;
- one naming two objectives.

A verdict needs a saved review that judged it, so it is proved by unit tests only.
