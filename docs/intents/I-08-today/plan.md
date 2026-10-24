# Plan — I-08 · Today, with Log time

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-10-24 · **Written:** 2026-10-24

## What the code has today, and what changes

| Today | Where | Becomes |
|---|---|---|
| `GET /v1/day/{date}` returns everything the design reads but the plan's end (G24–G28 done in I-03; overlap refused, start time required, G29) | `today/domain/assembleDay.ts`, `shared/contract.ts` | `DayObjective.end_date`: the last segment's end (G45). No query change: the row already carries every segment |
| Today renders the old layout: three totals and a plain list, nothing to click | `(app)/(today)/page.tsx`, `today.module.css` | The designed page. The server component reads the day as now and hands it to a client `Today` that draws header, summary, filter, cards, rail and dialog |
| No page rule for Today's wording | — | Pure `today/domain/todayView.ts` (summary, card, rail, labels) and `today/domain/logTime.ts` (times, the dialog's checks and hint, the body, the toasts), each at 100 % (ADR-007) |
| No dialog, no shortcuts; the toast has no action and lasts 2.8 s | `src/app/toast.tsx` | `src/app/(app)/Dialog.tsx` (native `<dialog>`, bottom sheet on phone), `src/app/(app)/shortcuts.ts` (`useShortcut`), and the toast takes an **Undo** and stays 5 s with it |
| New objective holds the only copy of the app's field pieces (TRIAGE, I-06: "the next screen with a form should start from one shared set") | `objectives/new/NewObjectiveForm.tsx` | `FieldError`, `described`, `CountedLabel` move to `src/app/(app)/form.tsx`; New objective and Log time import them. The auth copies stay (they read the auth surfaces) |
| `PageHeader`'s action has no key hint | `(app)/PageHeader.tsx` | The desktop action can show its key (`L`), in the bordered key the design describes |

**Reused, not copied:** `overlapping`, `spanLabel`, `START_TIME` (`effort/domain/validateWrite.ts`)
for the dialog's overlap check and the time shape the API takes; `dayLabel`, `duration`
(`objectives/domain/newObjective.ts`) for "Mon 7 Sep" and "1h 20m"; `localDayOf`
(`shared/time/localDay.ts`) for "has the day turned"; the I-06 toast and `PageHeader`
`action`/`phoneAction`; the server's overlap words (`Overlaps 09:20–10:20. Change the
times.`, `effort/service.ts`).

**Which card an objective gets** (`todayView.ts`, from the day alone):

| The day says | Card | Note | Log |
|---|---|---|---|
| `slot.period_kind === "day"` | Planned today | "1h 20m to go" · "Planned time met" · "Planned time met · +30m over" | **+ Add entry** |
| `date > end_date` | Not planned | "Plan ended Fri 4 Sep · final review due" | none |
| `start_date > date` | Not planned | "Not planned today · next on {next_planned_date}" | none (G44) |
| `next_planned_date` null | Not planned | "Not planned again · plan ends Wed 9 Sep" | **Log anyway** |
| otherwise | Not planned | "Not planned today · next on Mon 7 Sep" (+ "· 1h 20m extra today") | **Log anyway** |

Log time's chips are the objectives with `start_date ≤ date ≤ end_date` (G44).

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/intents/I-08-today/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 2 | `src/shared/contract.ts`; `today/domain/assembleDay.ts` (+ test); `today/computed-slot.itest.ts` | `end_date` on each `DayObjective`, the latest segment's end. The contract already has it (spec commit) |
| 3 | `src/modules/today/domain/todayView.ts`, `logTime.ts` *(new, + tests)* | Pure rules, listed below. Nothing uses them yet |
| 4 | `src/app/(app)/Dialog.tsx`, `dialog.module.css`, `shortcuts.ts`, `form.tsx` *(new)*; `src/app/toast.tsx`, `toast.module.css`; `PageHeader.tsx`, `shell.module.css`; `objectives/new/NewObjectiveForm.tsx` | The shared patterns. The toast with an Undo stays 5 s and pauses while hovered or focused; its existing callers are unchanged (`show(text)`); New objective moves onto `form.tsx` with no visible change. TRIAGE's "form pieces are copied" entry is narrowed to the auth copies |
| 5 | `src/app/(app)/(today)/page.tsx`, `Today.tsx` *(new, client)*, `today.module.css` | The page, read-only: header with the long date, summary (ring, day off, This week / Extra), filter, Planned and Not planned cards, the rail's Plan to date, the empty card with **+ Add objective**, the error and reset notices as today. Desktop, 861–1180 px, phone |
| 6 | `Today.tsx`, `LogTime.tsx` *(new)*, `today.module.css` | Log time: **+ Log time**, `L`, **+ Add entry**, **Log anyway**. Sends `POST /objectives/{id}/effort-entries` once; refreshes the day (`router.refresh()`); flashes the new row; toast "Logged 1h to …" with **Undo** (`DELETE`) |
| 7 | `Today.tsx`, `LogTime.tsx` | Edit entry from a row: **Save** sends `PATCH` (Undo patches the old values back), **Delete entry** sends `DELETE` (Undo logs it again as it was) |
| 8 | `docs/intents/TRIAGE.md` | Findings outside the intent |

### The pure rules

`todayView.ts`:
- `longDate(date)` → "Saturday, 5 September".
- `summary(day)` → the ring's percentage, or day off; "1h 20m to go of 6h planned", "plan met for all 6h", "all of it extra, nothing was planned"; This week and Extra.
- `card(o, date)` → the table above.
- `railRow(o, date)` → "Day 1", "Not started", or the track's pill and percentage.
- `loggable(o, date)` → whether the plan covers today.

`logTime.ts`:
- `parseTime` → "920", "0920", "9:20", "9.20" and "21" → "09:20" / "21:00".
- `nowTimes(now, zone, start)` → **Now**.
- `checkEntry(draft, ctx)` → the design's four messages, in page order. An overlap is checked against every entry on the page except the one being edited, by `overlapping`, and the message carries the clashing entry's note, cut to fit.
- On success, `checkEntry` gives the body: `local_date` and `tz` are the day and zone Today shows, `occurred_at_local` the start, and `minutes` the end minus the start.
- `hint` → "Leaves 20m on today's plan" · "Meets today's plan" · "Counts as extra, off-day time"; on edit, the entry's old minutes are taken out first.
- `buttonLabel` → "Log 1h", or "Log time" until the times are valid.
- The toasts' words: logged, updated, deleted, and their undone forms.

## Order of work

1. **Accept the plan.** `plan.md` committed alone.
2. **`end_date` on the day.** The only backend change.
3. **Today's pure rules.** Nothing uses them yet.
4. **The shared patterns:** dialog, shortcuts, the toast's Undo, the shared form pieces, the header's key hint. Nothing opens a dialog yet.
5. **Today, read-only, as designed.** Every state but logging.
6. **Log time**, with its Undo.
7. **Edit and delete**, with theirs.
8. **Proof** on localhost, then TRIAGE. The intent's check runs on the deployed service after the merge.

No migration, no infra, no dependency. The contract change (G45) is already in
`docs/keel-api.yaml` from the spec commit.

---

## Risks

**What could break**

- **Today itself.** It is the page every signed-in user lands on. Step 5 replaces it
  whole; a render error there is a broken home page. `error.tsx` stays.
- **A write that lands twice, or on the wrong day.** Double clicks, Enter held down,
  `L` while the dialog is open. And a page left open past midnight: the body carries
  the page's day, which the server refuses as `not-today` (422).
- **Undo that undoes the wrong thing.**
  - An edit's Undo patches the old values back over whatever is there now, so an edit from another tab in the same 5 s is overwritten.
  - A deleted entry comes back with a new id.
  - An Undo after midnight is refused (422), and the toast must say so.
- **The page and the server disagreeing.** If the dialog's checks are looser than the
  API's, a save fails with a 422 the person can't fix in the dialog. The API's rules
  are the bound: start `HH:MM`, minutes 1–1440, note 1–2000 (the design caps it at
  120), no overlap, today only, inside the plan.
- **The toast changing under existing callers.** New objective and the auth screens
  call `show(text)`; they must keep 2.8 s and no button.
- **Moving New objective's field pieces.** A live page changes files; it must look and
  behave the same.
- **`router.refresh()` and `loading.tsx`.** If a refresh shows "Loading your day…",
  every save flashes the page.
- **Tap → render (NFR-04, ≤ 100 ms).** A save waits for the `POST` and then the
  refresh, which re-runs the layout's session check, `zoneOf` and the day read. To meet
  it, the dialog closes and the toast shows as soon as the write answers; the figures
  follow when the refresh lands. If the refresh is slow, the figures lag the toast.
- **Overlaps the page can't see.** The day lists active objectives only. An entry
  logged today on an objective paused since still blocks an overlapping one on the
  server. The dialog misses it, and the server's words show instead.
- **Entries the dialog can't hold.**
  - An entry written through the API before G29 may have no start time. Its row shows no span, and Edit opens with Start empty: saving needs one.
  - A note longer than the design's 120 characters (the API allows 2000) must open whole and stay saveable unchanged. The 120 cap applies only to new text, so an edit never cuts a note.
- **Midnight.** An entry can't cross it: "End time must be after start time" refuses
  23:30–00:30. **Now** at 00:20 can't put Start an hour earlier, so it sets 00:00.
- **The clock in the dialog.** **Now** and "has the day turned" read the time in the
  zone Today shows, not the browser's. When the two differ (travel, out of scope), Now's
  time is the stored zone's.
- **`L` and the browser's own keys.** `L` with ⌘, Ctrl or Alt (⌘L is the address bar)
  must do nothing. So must `L` while focus is in the filter, a menu or the account menu.
- **Undo's 5 s and the keyboard (WCAG 2.2.1).** A keyboard or screen-reader user may
  not reach **Undo** in time. The toast's timer pauses while it is hovered or holds
  focus. A second save replaces the toast, so the first Undo is gone.
- **Native `<dialog>` on phones.** iOS Safari's bottom sheet with the keyboard up must
  still show the buttons (max 92 vh, scrolls inside, inputs 16 px). Checked on the
  390 px Chrome view only; a real iPhone is not in this proof.
- **Shared patterns set early.** The dialog, `useShortcut` and the toast's Undo become
  what Deviations and Parking lot build on. A shape that only fits Log time costs a
  change there.

**How each risk is handled**

*Prevented* means the code stops it and a test proves it. *Contained* means it can
happen, but nothing wrong is recorded. *Accepted* means it can happen, said plainly.

| Risk | Handling | Prevented by | Proved by |
|---|---|---|---|
| Today breaks on render | Contained | `error.tsx` stays; the page reads only the day's fields | Chrome, every state at 1280 / 1000 / 390 px (step 5) |
| A save sent twice | Prevented | A ref guard set before the request, plus `disabled`/`aria-busy`; `L` is ignored while a dialog is open | Chrome: a double click and Enter held down each send one `POST` (step 6) |
| Logged to the wrong day | Prevented | `localDayOf(now, zone)` is checked before sending; the server's `not-today` 422 is handled the same way | `logTime.test.ts`; Chrome with the clock moved (step 6) |
| The dialog passes what the API refuses | Prevented | `checkEntry` stays within the API's bounds | **A contract test:** a grid of drafts; every body `checkEntry` passes is one `validateEffortEntryWrite` accepts (step 3) |
| The toast changes for existing callers | Prevented | `show(text)` keeps 2.8 s and no button; Undo is a second, optional argument | Chrome: New objective's and the auth screens' toasts (step 4) |
| New objective changes when its field pieces move | Prevented | The pieces move as they are, with no edits | Chrome: New objective's errors, counters and focus unchanged (step 4) |
| A save flashes "Loading your day…" | Prevented | `router.refresh()` runs inside `startTransition`, so the old page stays until the new one is ready | Chrome (step 6) |
| A save's figures lag its toast (NFR-04) | Accepted, measured | The dialog closes and the toast shows when the write answers; the figures follow the refresh | Chrome timing locally (step 6). On the deployed service it is the write's round trip, unmeasured until the release check |
| An edit's Undo overwrites another tab's edit made in the same 5 s | Accepted | Preventing it needs a version check the contract doesn't have | — |
| A deleted entry comes back with a new id | Accepted | The spec says "logged again as it was"; nothing refers to an entry's id | — |
| Undo after midnight | Prevented | The server refuses it (422); the toast says it couldn't undo, and the record stays | `logTime.test.ts` (the words); Chrome (step 6) |
| An overlap with a paused objective's entry | Contained | The server refuses it; the dialog shows the server's words | itest coverage exists (G29) |
| An old entry with no start time, or a note over 120 characters | Prevented | Edit opens with Start empty and requires one; the 120 cap applies only to new text | `logTime.test.ts` (step 3) |
| An entry across midnight; **Now** at 00:20 | Prevented | Refused with the design's end-after-start error; Now clamps Start to 00:00 | `logTime.test.ts` (step 3) |
| `L` firing with ⌘/Ctrl/Alt, while typing, or in a dialog | Prevented | A pure `isShortcut(event)` predicate, unit-tested, used by `useShortcut` | A test of the predicate (step 4); Chrome (step 6) |
| A keyboard or screen-reader user can't reach Undo in 5 s | Prevented | The timer pauses while the toast is hovered or holds focus | Chrome: Tab to Undo and wait past 5 s (step 6) |
| The phone sheet hides its buttons behind the iOS keyboard | Accepted, checked after release | 92 vh max, scrolling inside, 16 px inputs | Chrome 390 px only here. The intent's check runs on a real phone after the release |
| The shared dialog, shortcuts and Undo fit only Log time | Accepted | Kept generic: title, body, footer; a key and a handler; text and an optional undo | Revisited when Deviations uses them |
| Old flexible test data | Contained | It reads as Not planned, with **Log anyway** | `todayView.test.ts` (step 3) |
| An all-paused account sees "Add your first objective" | Accepted | Telling it apart needs a second read (NFR-03); goes to TRIAGE | — |

**The riskiest step: 6.** It is the first write on Today, and it brings the dialog,
`L`, the refresh and Undo together. Mitigations:
- `logTime.ts` at 100 %, with the bounds above as its tests;
- a ref guard plus `disabled`/`aria-busy`, as New objective does;
- the day checked before sending, and `not-today` handled the same way;
- in Chrome: a double click sends one `POST` (network log), Undo sends one `DELETE`, and the page never shows its loading state on save.

**What was not chosen**

- **A dialog library.** Native `<dialog>` with `showModal()` gives the scrim, `Esc`,
  an inert page behind it and focus back on close, with no dependency (spec).
- **Optimistic updates.** The page shows what the server read back, after each save.
  One round trip more, and no figure the server didn't compute.
- **A client copy of the plan rules.** The card, ring and hint read the day's own
  fields; the page only counts and formats (spec).
- **Sending the browser's zone.** The dialog sends the day and zone Today shows, the
  stored one (I-07), so the day it writes is always the day on screen. While
  travelling they can differ; travel is out of scope (I-07).
- **The full overlap words for a clash the server finds.** The page knows only its
  own entries. A clash with an entry from another tab shows the server's words, "Overlaps
  09:20–10:20. Change the times.", without the note in brackets.
- **A separate empty state for an account whose objectives are all paused or ended.**
  The day returns active objectives only, so it sees the empty card too. Telling them
  apart needs a second read (NFR-03); left to TRIAGE.
- **A flexible card.** Old test data may hold a flexible objective; it reads as Not
  planned today, with **Log anyway** (it plans no day; I-09).
- **Moving the auth screens onto `form.tsx`.** They read the auth layout's surfaces;
  the TRIAGE entry stays for them.
- **The rail's deviation buttons and last-deviation card, `D` and `P`.** Out of scope.

---

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | — | Docs only |
| 2 | `assembleDay.test.ts`: `end_date` is the latest segment's end, with and without an extension. itest (CI): the day returns it | Additive field, already in the contract |
| 3 | `todayView.test.ts` and `logTime.test.ts`, at 100 %:<br>• every card in the table at its boundary: `date = end_date` vs the day after; start today vs tomorrow; no next planned day<br>• the ring at 0 %, partial, and 100 % with one objective over plan<br>• day off, with and without logging<br>• every time form in the design, plus `2400`, `9:60` and `abc`<br>• end = start; 23:30–00:30 refused; **Now** at 00:20 → 00:00–00:20<br>• overlap: a 10:20 start after a 09:20–10:20 entry passes, one minute in fails, and editing an entry never overlaps itself<br>• the hint on edit<br>• a new note capped at 120; an old 300-character note saved unchanged<br>• an entry with no start time opens with Start empty<br>• **the contract test:** a grid of drafts (every time form, both edges of the times, notes of 1 and 120 characters, planned and unplanned objectives); every body `checkEntry` passes is one `validateEffortEntryWrite` accepts | Unused code |
| 4 | `shortcuts.test.ts`: `isShortcut` is false with ⌘, Ctrl or Alt, in an input or textarea, or with a dialog open, and true for a plain `l` and `L`. Build. Chrome: New objective unchanged (errors, counters, focus); the auth screens' toast still 2.8 s, no button | No screen uses the dialog or Undo yet |
| 5 | Chrome at 1280, 1000 and 390 px against seeded local data (a planned objective, one not planned, one starting tomorrow, one ended before its review, one with no planned day left, an empty account): every card, the ring, day off, filter (summary unchanged), rail pills, long names cut and read whole (`read_page`), the empty card opens New objective | Same read as before; no writes |
| 6 | Chrome:<br>• log on a planned and an unplanned objective<br>• each design error, in its words<br>• overlap with a row on the page; a second tab's entry → the server's overlap words<br>• a double click → one `POST`<br>• `L` opens Log time on Today only, not while typing, and ⌘L / Ctrl+L do nothing<br>• focus returns to the opener<br>• the dialog closes and the toast shows before the figures move, and `loading.tsx` never shows<br>• the toast stays while Undo has focus; Undo → one `DELETE`, figures back<br>• the clock past the day → nothing logged, Today moves on<br>• a signed-out session → Sign in | — |
| 7 | Chrome: edit and delete with Undo each; figures match after each; Delete's Undo brings the row back | — |
| 8 | GIF of the journey on desktop and phone. After the release: the intent's check on the deployed service | — |

Integration tests run in CI only (step 2's). Everything else is pure tests and Chrome.
