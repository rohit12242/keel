# Plan — I-11 · Objectives, list and detail

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-10-30 · **Written:** 2026-10-30

## Context

An objective can be created and logged against, but nothing shows one as a whole.
`/objectives` says "This screen isn't built yet", and New objective lands on Today.
This builds the design's list and detail with the Overview and Effort tabs
(`04-objectives.md`, `01-shell.md`), from the API as it stands. There is no API or
contract change.

## What the code has today, and what changes

| Today | Where | Becomes |
|---|---|---|
| A placeholder page with **+ New objective** | `src/app/(app)/objectives/page.tsx` | The list: filters with counts, rows, empty states. On desktop the filter's first objective is open beside it |
| No detail | — | `/objectives/[id]`: the list beside the detail on desktop, the detail alone on phone with **‹ Objectives** |
| `GET /v1/objectives`, `GET /v1/objectives/{id}` (with `weeks`, `status_history`, `figures`, `figures_to_date`, `last_logged_on`), `…/schedule`, `…/effort-entries` exist and nothing on screen reads them | `src/app/v1/objectives/…` | Read as they are, never changed |
| New objective ends in a toast and `router.push("/")` | `NewObjectiveForm.tsx` | The same toast, then `/objectives/{id}?created=1`: selected under Active, its row flashing once. Onboarding passes `onCreated`, so it still ends on its step 3 |
| The dialog is 520 px | `src/app/(app)/Dialog.tsx` | An optional `wide` (640 px) for the week dialog |
| Onboarding's step 3 builds the plan line ("Fixed · Every day · 45m a day · weekly reviews · …") | `modules/onboarding/domain/onboarding.ts` | That builder moves to the objectives rules. The detail's meta line is the same line, and onboarding imports it |
| Today's entry rows and track words take a `DayObjective` | `modules/today/domain/todayView.ts` | Split so a list of entries, and a track, can be passed on their own. Today calls them as before |

**Reused, not copied:**
- **Dates and durations:** `dayLabel` and `duration` (`newObjective.ts`); `compact` and `total` (`todayView.ts`); `spanLabel` (`effort/domain/validateWrite.ts`).
- **Shared screen parts:** `Dialog` and `dialogParts`; `useToast`; `PageHeader`; `requireUser`; `zoneOf` with `localDayOf`, the day the API itself calls today.
- **Figures and pills:** the track words Today's rail shows, so a row's percentage and band read as Today's Plan to date. Both come from the same `trackOf` over the same to-date figures.
- **The week rule:** `weeks` from the API, the server's `planWeeks`. The page never splits weeks itself.

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/intents/I-11-objectives/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 2 | `src/modules/objectives/domain/objectiveView.ts` *(new, + test)*; `effortView.ts` *(new, + test)*; `onboarding/domain/onboarding.ts` (+ test); `today/domain/todayView.ts` (+ test) | The pure rules, below. Onboarding and Today switch to the shared pieces, and their tests still pass |
| 3 | `src/app/(app)/readApi.ts` *(new)*; `Dialog.tsx`, `dialog.module.css` | One server reader for `/v1/...` with the request's cookie (D-04), answering with the value, `signed_out`, `not_found` or `unreachable`. The dialog's `wide`. Unused yet |
| 4 | `src/app/(app)/objectives/[id]/page.tsx`, `ObjectiveDetail.tsx`, `objectives.module.css` *(new)* | The detail: head, pill, tabs (Overview only for now), and the Overview. Reachable by URL only |
| 5 | `ObjectiveDetail.tsx`, `EffortTab.tsx`, `WeekDialog.tsx` *(new)*, `objectives.module.css` | The Effort tab: Last day, By week, and the week dialog. Days are read when the tab or the dialog opens |
| 6 | `src/app/(app)/objectives/page.tsx`, `ObjectiveList.tsx` *(new)*, `[id]/page.tsx`, `objectives.module.css`; `docs/design/screens/04-objectives.md` | The list replaces the placeholder. Desktop shows list and detail side by side; on phone each address shows one or the other. The design gets the tile's new name |
| 7 | `NewObjectiveForm.tsx` | After Create: the toast, then `/objectives/{id}?created=1`. The row flashes once, then the `?created` goes from the address |

### The pure rules

**`objectives/domain/objectiveView.ts`** (list and detail)
- **Lines that describe the plan:**
  - `scheduleLine`: "Fixed · Mon–Sat · 2h a day". The days read "Every day", "Mon–Fri" for a run of three or more, else "Mon, Wed, Fri".
  - `planLine`: the schedule line plus "· weekly reviews · Sun 23 Aug – Mon 21 Sep". This is onboarding's line, moved here.
- **The list:**
  - `filters(objectives)`: Active · Paused · Completed · Terminated with their counts, always all four. Terminated is the API's `ended`.
  - `inFilter(objectives, filter)`: the latest start first.
  - `emptyLine(filter)`: "Nothing active." / "Nothing paused." / "Nothing completed." / "Nothing terminated.".
- **A row**, `row(o, today)`:
  - the progress percentage;
  - line 4 left: "Day 14 of 30" · "Starts Sun 6 Sep" · "Ended Fri 4 Sep" · "Mar – Aug · 25 weeks" · "Ended 5 Sep";
  - the pill and its tone, from the design's table: `80% · On track` / `At risk` / `Behind`, `Day 1 · no score yet`, `Not started`, `Plan ended · final review due`, `Paused`, `Completed · 84%`, `Terminated`;
  - "n reviews due" from `reviews_due`.
- **The head pill**, `headPill(o, today)`: "Active · Day 14 of 30" / "Paused since 5 Sep" / "Completed · 84%" / "Terminated 5 Sep" / "Starts Sun 6 Sep" / "Plan ended · final review due".
- **The plan so far**, `soFar(o, today)`:
  - Before the first day has passed: "It started today. / It starts Sun 6 Sep. Numbers appear once the first day has passed."
  - Otherwise:
    - the heading: **So far**, or **The whole plan** once the plan has ended or the objective is completed or terminated;
    - the range: "Sun 23 Aug – Sat 5 Sep · 14 of 30 days";
    - the figures: `figures_to_date`, or `figures` once ended;
    - the ring's percentage and tone; there is no arc at 0;
    - **Logged effort**: "20h 40m", hint "of 24h 00m planned", with no "+ over" part (Rohit, 2026-10-30);
    - **Targets met**: "8 of 12", hint "planned days";
    - **Unplanned day effort**: "1h 30m", time only (Rohit, 2026-10-30).
- **The state banner**, `banner(o)`: Paused since / Terminated / Completed, with the latest event's reason in quotes.
- **The footer**, `footerLine(o)`: the design's words, without the buttons.
- **Status history**, `history(o, today)`, newest first, each row a date, a dot kind, a label and text:
  - **Created**, on its event's day: "Fixed · Mon–Sat · 2h 00m a day · 30 days.", or "4 weeks." when the days divide by seven. "From a parked idea." goes first when it was one.
  - **Active**, on the start day, once it has come: "Started. Planned till Mon 21 Sep with weekly reviews."
  - **Paused**, **Resumed** and **Terminated**: the reason, word for word.
  - **Completed**: "Completed at the final review.", plus the criteria verdict when there is one.
  - **Extended**: "Extended at the final review, now planned till Fri 25 Sep. {that segment's schedule line} · weekly reviews."

**`objectives/domain/effortView.ts`** (the Effort tab)
- `dayTag(day)`: from the grid's state, target and logged minutes. "✓ Met", "✓ Met · +30m over", "− Short 20m", "✕ Missed", "+ Extra on an off day", "Off day", each with a tone.
- `lastDay(o, grid, entries, today)`: the card for `last_logged_on`.
  - The title: "Sat 5 Sep", plus "· today" when it is today.
  - The line: "planned 2h 00m · 2 entries", or "off day · 1 entry".
  - The bar's width, the logged figure, the tag, and the entry rows.
  - With no `last_logged_on`: "Nothing logged yet."
- `weekRows(o, today)`: from `o.weeks`, the weeks that have begun.
  - Each is "Week n · Mon 31 Aug – Sun 6 Sep", plus "so far" for the current week.
  - The columns: Planned, Logged, Days met "3 of 6", Over plan "+30m" / "0m", Unplanned day effort.
- `weekDialog(week, n, grid, entries, today)`:
  - the title and the sub-line ("Planned 12h 00m · logged 10h 25m · 3 of 6 met · +30m over plan");
  - the day chips;
  - one block per day up to today, each with its tag and entries, or "Nothing logged.".

---

## Order of work

1. **Accept the plan.** `plan.md` committed alone.
2. **The pure rules**, at 100 % coverage (ADR-007). Onboarding and Today take the moved pieces with no visible change, except one: onboarding's step 3 reads "2h a day" for a whole-hour target, where it read "2h 00m a day".
3. **The shared reader and the wide dialog.** Unused yet.
4. **The detail with Overview** at `/objectives/{id}`, by URL only.
5. **The Effort tab** and the week dialog.
6. **The list**, replacing the placeholder, with the detail beside it on desktop. The design doc's tile name changes here.
7. **New objective opens what it created.**
8. **Proof** on localhost. The intent's check runs on the deployed service after the merge.

No migration, no infra, no dependency, no contract change.

---

## Risks

**What could break**

- **New objective (step 7).** It is a live flow, so after the change three things must still hold:
  - one POST, whatever the clicks;
  - the toast;
  - onboarding's own ending.
- **The Objectives page (step 6).** A link everyone has. A wrong filter, count or selection, or on phone a list that never shows, or a detail that never does.
- **A figure that disagrees with Today.** The row's percentage and band must be `figures_to_date` and `track` as the API gives them. Today reads the same `trackOf` over the same figures. The page computes no plan or adherence of its own.
- **The day.** Some words compare dates with today: "Day 14 of 30", "Starts", "plan ended", "so far", and future days left out. That must be the API's today: the user's zone (`zoneOf` + `localDayOf`), passed down from the server page as Today's page does. It is not the browser's clock.
- **Onboarding and Today (step 2).** They switch to shared rules. Today's words must not change at all. Onboarding changes only in the whole-hour case above.
- **The week dialog's reads.** Two reads per opened week, one for the grid and one for the entries. A failed read must say so, not show an empty week as "Nothing logged."
- **Reads per navigation.** Opening an objective reads the list and the objective. On phone, `/objectives` also reads the first objective's detail, which it hides. That's one extra read per list visit on phone.

**How each risk is handled**

| Risk | Handling | Prevented by | Proved by |
|---|---|---|---|
| A row disagrees with Today | Prevented | `row` takes `figures_to_date.adherence_pct` and `track` as given, through the track words Today's rail uses | `objectiveView.test.ts`; Chrome: a running objective's pill matches Today's Plan to date |
| The page invents a week or a day state | Prevented | Weeks are `o.weeks`; a day's tag is from the grid's `state`, target and logged minutes; entries from `effort-entries` | `effortView.test.ts` takes every figure from its input |
| The wrong today | Prevented | The server page passes `today` from `zoneOf` + `localDayOf` | Tests run under three zones (`test:tz`) |
| New objective changes beyond its ending | Prevented | Only the 201 branch without `onCreated` changes; the `sending` ref stays | Chrome: a double click sends one POST; the toast; the row selected under Active; onboarding still ends on step 3 |
| Today or onboarding changes | Prevented | The moved rules keep their tests; Today's calls are re-pointed, not rewritten | `todayView.test.ts`, `onboarding.test.ts` unchanged except the whole-hour case; Chrome: Today as it was |
| A failed Effort read shown as empty | Prevented | The tab and the dialog have a failure line: "Couldn't load these days. Try again." | Chrome with the network off |
| An unknown or another user's id | Prevented | The API answers 404 (NFR-10), and the page sends it to `/objectives` | Chrome with a made-up id |
| The phone's extra read on `/objectives` | Accepted | The server can't know the width. It's one read, and only on that page | — |
| The `?created=1` flash coming back on a reload | Prevented | The row flashes, then `router.replace` drops the parameter | Chrome: a reload after Create doesn't flash |

**The riskiest step: 6.** It replaces a page everyone can open, and joins the list, the
filter, the selection and the phone's one-or-the-other in a single layout. Mitigations:
- The rules for filters, order, rows and empty states are already tested in step 2.
- The detail is already proven in steps 4–5.
- In Chrome, at 1280 and 767 px, every filter is checked: with objectives, empty, and with no objectives at all.

**What was not chosen**

- **An API or contract change** for the off-day count. Rohit chose to show the time only, under the new name.
- **Computing figures on the page.** Every number is the API's (spec).
- **The Deviations and Reviews tabs, the Deviation time tile, the due-review banner, and the actions** (Resume, Pause, Terminate, Open final review, + Add a note). These are out of scope.
- **The tab in the address** (`?tab=effort`). The spec gives each objective an address, not each tab. A reload opens Overview.
- **Fetching the Effort data with the page.** It's read when the tab opens, so opening an objective reads the objective and nothing more.
- **Listing weeks that haven't begun.** By week lists the weeks so far, ending with the current one, as the prototype does.
- **Sharing Today's ring and pills.** Today's ring is a different measure at a different size, so the Objectives ones are drawn in `objectives.module.css`. Moving Today's would change a live screen for nothing it needs.
- **Moving Today's and onboarding's fetches onto `readApi`.** They work as they are. That goes to TRIAGE as a follow-up.
- **A loading page for Objectives.** A navigation keeps the current page until the next one arrives.

**Decided, not specified** (for the PR)

- **The tile's name:** "Extra, off days" becomes "Unplanned day effort", showing time only, in the tile and the By week column (Rohit). Logged effort's hint drops "· +30m over"; over target still shows in By week's Over plan, the week dialog and the day tags (Rohit). `04-objectives.md` changes with both. Today's summary keeps "Extra, off days", and that goes to TRIAGE.
- **Pills and history words:**
  - "Day n · no score yet" for any running day before a score, not only day 1.
  - A Created row reads in weeks when the days divide by seven, otherwise in days.
  - The Completed history row carries the criteria verdict when there is one.
- **Lines and errors:**
  - Entry rows read "09:20–10:20", as on Today, not the design's "09:20 – 10:20".
  - A failed Effort read: "Couldn't load these days. Try again.".
- **Navigation:**
  - An unknown id goes to `/objectives`.
  - Opening an objective selects it under its own status's filter.
  - The week dialog's footer has the Esc hint and **Close**.
- **Onboarding:** step 3 now reads "2h a day" for a whole-hour target.

---

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | — | Docs only |
| 2 | `objectiveView.test.ts` and `effortView.test.ts` at 100 %:<br>• every row of the design's state table, line 4 and pill, for list and head<br>• filters with counts and the latest start first; the four empty lines<br>• So far: before the first day, to date, the whole plan; no "+ over" in Logged effort; the ring at 0<br>• history for every event kind, newest first; weeks or days; from a parked idea<br>• day tags for all five states, with over and short<br>• Last day: today, another day, none<br>• week rows: the current one "so far", weeks not begun left out<br>• the dialog: days after today left out, empty days<br>Plus `onboarding.test.ts` and `todayView.test.ts`, passing | Onboarding and Today change only as stated; the new rules are unused |
| 3 | Typecheck, build. The Log time dialog in Chrome, unchanged | Nothing uses `readApi` or `wide` |
| 4 | Chrome at `/objectives/{id}`, 1280 and 767 px:<br>• the head, the meta line, the pill<br>• Overview in the design's order: So far, or its line before day one; why it matters, criteria, notes or "No notes yet.", history, footer<br>• the tabs' roles and arrow keys<br>• a made-up id goes to `/objectives` | Only a typed URL reaches it |
| 5 | Chrome:<br>• Last day with today's entries, and "Nothing logged yet." on a new one<br>• By week from Week 1, the current week "so far"<br>• a week opens its days; future days aren't listed<br>• Esc and × close it; focus returns<br>• the network off shows the failure line | Same |
| 6 | Chrome, 1280 and 767 px:<br>• each filter with its count, and the empty filters<br>• "No objectives yet."<br>• the first objective open on desktop<br>• selecting a row; Back and Forward<br>• phone: list, then detail with **‹ Objectives**<br>• a running objective's pill equals Today's Plan to date | — |
| 7 | Chrome: Create opens the objective selected under Active, flashing once, with the toast; a double click sends one POST; a reload doesn't flash; onboarding ends on step 3 | — |
| 8 | After the release, the intent's check on the deployed service | — |

No itest changes, because the API is unchanged.

**Test data:** some states can't be made through the app today:
- a plan that has ended;
- completed;
- terminated, or paused with a reason (only the API does those);
- Week 2 and later.

The unit tests cover every one of them. For Chrome, two options, and Rohit chooses:
- a local test account given those rows by SQL in the development database;
- or those states seen on the deployed service with real data after the release.
