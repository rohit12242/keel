# Plan — I-16 · Parking lot

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-11-04 · **Written:** 2026-11-04

## Context

The backend for parked ideas is complete (I-02, I-03): park, the lock (`lockedUntil`,
`parking/domain/parking.ts`), `approved` (G4), notes (G3), `verdict_on` (G31), `taken`
dated the day of creation (G37), and `new_idea_locked_until` on `GET /parked-ideas?caught_on=` (G38).
`POST /objectives` already takes `from_parked_idea_id` and refuses one that isn't approved (422).
`GET /parked-ideas` returns every idea, newest caught first, notes included, in one read.

What's missing is all UI: `(app)/parking-lot/page.tsx` says "This screen isn't built
yet.", Today's rail has no Park an idea, and New objective has no "Start from" card.
**This is a UI intent. No API, contract, migration, infra or dependency change.**

## What the code has today, and what changes

| Today | Where | Becomes |
|---|---|---|
| Placeholder page | `(app)/parking-lot/page.tsx` | List and detail, `/parking-lot` and `/parking-lot/{id}`, built like Deviations |
| `ParkedIdea` typed only in the domain | `parking/domain/parking.ts` | `ParkedIdea`, `ParkedIdeaList` in `shared/contract.ts`, matching the contract |
| Toast Undo reverses something already sent | `app/toast.tsx` | Also an optional `onDone`, called when an Undo toast leaves without Undo: timed out, or replaced by another toast (G13) |
| Notes post to an objective | `objectives/Notes.tsx` | Takes the URL to post to, so a parked idea uses the same component |
| Rail: Log a deviation only | `(today)/Today.tsx` | Park an idea under it (muted), and `P` |
| No "Start from" | `objectives/new/NewObjectiveForm.tsx`, `new/page.tsx` | The card, only when the form has no options (onboarding passes options, so it keeps none) |

**Reused, not copied:**
- **The screen:** Deviations' shape. `read.ts` with `readApi` in parallel, `Screen` with `show="list" | "detail"`, the `[id]` page that redirects an unknown id to the list, `listDetail.module.css`, and `useFlashOnce` with `?parked=1`.
- **The dialog:** `Dialog` (`(app)/Dialog.tsx`), `dialogParts`, `FieldError`, `CountedLabel`, `errorIdOf`, `describedBy` (`(app)/form.tsx`), and the shake.
- **The provider pattern:** `LogDeviationProvider` / `LogDeviationButton`. `ParkIdeaProvider` / `ParkIdeaButton` copy its shape: open state, `busy` held once in the provider, and a shortcut flag.
- **The send:** the `sending` ref and `release()` (`LogDeviation.tsx`), `refresh` inside `startTransition`.
- **Keys:** `useShortcut` (`(app)/shortcuts.ts`). **D** on the Parking lot: wrap it in `LogDeviationProvider`, as the TRIAGE entry "`D` on the Parking lot" (I-12) says. That entry is then removed.
- **The day:** `localDayOf(new Date(), tz)` at send time; `zoneOf` on the server pages; `useBrowserDay` in New objective.
- **Words:** `NOTE_*` from `objectives/domain/statusActions.ts`; `dayLabel` and the short-date helpers already in `deviationView.ts` / `newObjective.ts` where they fit "31 Aug".

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/intents/I-16-parking-lot/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 2 | `parking/domain/parkingView.ts` *(new, + test)*; `parking/domain/parkIdea.ts` *(new, + test)*; `parking/domain/startFrom.ts` *(new, + test)*; `shared/contract.ts` | The pure rules and words below. No screen uses them yet |
| 3 | `parking-lot/page.tsx`; `parking-lot/[id]/page.tsx` *(new)*; `parking-lot/read.ts`, `Screen.tsx`, `IdeaList.tsx`, `IdeaDetail.tsx`, `LockInfo.tsx`, `parkingLot.module.css` *(new)* | The Parking lot, read only, with `D` |
| 4 | `(app)/ParkIdea.tsx`, `(app)/parkIdea.module.css` *(new)*; `parking-lot/Screen.tsx` (header, empty state) | Park an idea from the Parking lot, and `P` there |
| 5 | `(today)/Today.tsx`, `today.module.css` | Park an idea on Today's rail, and `P` |
| 6 | `objectives/Notes.tsx`; `objectives/ObjectiveDetail.tsx`; `parking-lot/IdeaDetail.tsx` | Notes on an idea |
| 7 | `app/toast.tsx`; `parking-lot/useHeldVerdict.ts`, `Verdict.tsx`, `DropDialog.tsx` *(new)*; `IdeaDetail.tsx`, `Screen.tsx` | Your verdict, Drop, and the held send (G13) |
| 8 | `objectives/new/page.tsx`; `objectives/new/NewObjectiveForm.tsx`, `StartFrom.tsx` *(new)*, `newObjective.module.css`; `objectives/domain/newObjective.ts` (+ test) | Start from an approved idea |
| 9 | `docs/intents/TRIAGE.md` | Remove "`D` on the Parking lot"; add the findings below |

Paths in `parking/…` and `objectives/domain/…` are under `src/modules/`. The `.tsx`, `.ts`
and `.css` paths in the other rows are under `src/app/(app)/`, except `app/toast.tsx` and
`shared/contract.ts`.

### The pure rules (step 2)

**`parkingView.ts`, the screen**
- `pill(idea, today)`: `{ state, row, detail, info }`. `state` is one of `locked | open | approved | taken | dropped`.
  - **Locked:** `verdict === "parked"` and `locked`. Row and detail say "Locked · opens 2 Nov", and `info` is true.
  - **Open:** parked and not locked. Row "Open · decide now", detail "Open since 21 Sep · decide now".
  - **Approved / Taken / Dropped:** "Approved 22 Sep", "Taken 31 Aug", "Dropped 21 Sep", from `verdict_on`, with "· early" when `decided_early`.
- `lockRule(idea)`: the tooltip, "Locked until 2 Nov, the latest end date among the objectives running on 14 Sep, the day you caught it (System design). Deciding earlier is recorded as early." The parenthesis comes from `objectives` when the idea's lock date matches one objective's end. With no match the parenthesis is left out.
- `caught(idea)`: "Caught 31 Aug". `approvedLine(idea)`: "Approved on 22 Sep. It moves to Taken when you pick it while creating an objective."
- `takenLine(idea, objective)`: "Became an objective on 31 Aug, before it opened on 21 Sep. Runs 1 Sep – 2 Nov.". "before it opened on …" only when early. "Runs …" only when the objective is found.
- `footer(idea)`: `verdicts` for parked or approved, or the final line "The verdict is final. You can keep adding notes."
- **Held verdicts:**
  - `heldIdea(idea, verdict, note, day)`: the idea as it will read once sent, with `verdict`, `verdict_on = day`, `note`, and `decided_early = day < locked_until` (`parking-lock.md`). The page shows it until the server answers.
  - `verdictBody(verdict, day, note)`.
  - Toasts: `APPROVED` "Approved. Pick it when you create an objective."; `BACK` "Back in Parked."; `DROPPED` "Dropped. Both reasons are kept."; `UNDONE` "Undone."; `ALREADY_SENT` "Already saved; it can't be undone now.".
- **Drop:**
  - `DROP_WHY_MAX = 280`;
  - `checkDrop(text)` gives "Write why you're dropping it." for blank or spaces only.
- **Failures:**
  - `VERDICT_NOT_SAVED`: "Couldn't save your verdict. Nothing was changed. Try again.";
  - `CHANGED_ELSEWHERE`: "This idea changed somewhere else. Nothing was changed here.".
- `EMPTY`: the empty state's words and three steps.

**`parkIdea.ts`, the dialog**
- `IDEA_MAX = 120`, `WHY_MAX = 280` (the design's limits; the contract allows more).
- `checkIdea(draft)`:
  - errors "Enter the idea." and "Add why it grabbed you."; spaces only counts as blank;
  - `first` for focus;
  - the body `{ idea, why, caught_on }`, sent as typed.
- `lockNote(today, newIdeaLockedUntil)`:
  - `{ tone: "caution", text: "Locked until 2 Nov, … Taking it or dropping it before then is recorded as early, not blocked." }`;
  - `{ tone: "muted", text: "No objectives are running, so it opens straight away." }` when the date is today;
  - `null` when the read failed or hasn't arrived.
- `parkedToast(idea)`: "Parked. Locked until 2 Nov." when `locked_until > caught_on`, else "Parked.". `NOT_PARKED`: "Couldn't park it. Nothing was saved. Try again.".

**`startFrom.ts`, New objective**
- `approved(ideas)`: approved ideas, in the API's order.
- `approvedLine(n)`: "2 ideas in the Parking lot are approved and waiting." / "1 idea … is approved and waiting." / "None approved yet in the Parking lot.".
- `ideaMeta(idea)`: "Caught 31 Aug · approved 22 Sep".
- `search(ideas, q)`: case-insensitive match on the idea and why. `showSearch(ideas)` is true when there's more than one.
- `fillFrom(draft, previous, next)`: sets Name to `next.idea` (cut to `NAME_MAX` 80) and Why to `next.why` (cut to 280). It sets each only when that field is empty, or still equals what `previous` filled in.
- `checkStart(choice, ideaId)`: "Pick an approved idea, or start from scratch." when nothing is chosen, or "An approved idea" is chosen with no idea picked.
- **`newObjective.ts`:** `checkDraft` takes an optional `from_parked_idea_id` and puts it in the body. Without it, nothing changes, so onboarding is unchanged.

---

## Order of work

1. **Accept the plan.** `plan.md` committed alone.
2. **The pure rules,** at 100 % (ADR-007), plus `ParkedIdea` in `shared/contract.ts`. Nothing renders them yet.
3. **The Parking lot, read only.**
   - `read.ts` reads `GET /parked-ideas` and `GET /objectives?status=all` in parallel. The objectives give a Taken idea's dates and the lock tooltip's name, and they feed `LogDeviationProvider`.
   - **Desktop:** the list, with the newest idea selected, and the detail beside it. **Phone:** `/parking-lot/{id}` shows the detail with **‹ Parking lot**. An unknown id redirects to the list (NFR-10).
   - **The detail:** caught and the pill; the title; Why it grabbed you, and Why it ended beside it when Dropped; the Approved line; the Taken line; the notes, read only for now; the final line. The verdict control isn't there yet.
   - **The ⓘ** (`LockInfo`) is a button with `aria-expanded` and `aria-describedby` on the tooltip. Esc or a click outside closes it.
   - **The empty state:** the words and the three steps. Its button comes in step 4.
   - `D` works through `LogDeviationProvider`.
4. **Park an idea.**
   - `ParkIdeaProvider` wraps the Parking lot. The header gets **+ Park an idea** `P`, the phone header gets **Park an idea**, and the empty state gets its button.
   - **On open:** it reads `GET /parked-ideas?caught_on={today in zone}` for `new_idea_locked_until`, then shows `lockNote`. The page never works out the date. If the read fails, the note is left out and parking still works.
   - **Send:** `checkIdea` runs first (error, shake, focus). Then the `sending` ref and `POST /parked-ideas` with `caught_on = localDayOf(new Date(), tz)`.
   - **On 201:** clear every hold, close, show `parkedToast`, then `router.push('/parking-lot/{id}?parked=1')`. The row flashes once through `useFlashOnce`.
   - **On failure:** the dialog stays with what was typed, and `NOT_PARKED` shows. A 401 goes to sign-in.
5. **Park from Today.** `ParkIdeaProvider` sits inside Today's `LogDeviationProvider`. The rail gets **Park an idea** (muted) under Log a deviation, and `P` opens it when Today has objectives, as `D` does.
6. **Notes on an idea.**
   - `Notes` takes `postTo` in place of `objectiveId`. `ObjectiveDetail` passes `/v1/objectives/{id}/notes`; nothing else changes there.
   - `IdeaDetail` passes `/v1/parked-ideas/{id}/notes`, in every state.
7. **Your verdict** (riskiest; see Risks).
   - **Toast:** `toast.tsx` gains an optional `onDone`. It's called once when an Undo toast leaves without Undo: the timer ends, or `show` replaces it. Today's existing Undo passes none and is unchanged.
   - **`useHeldVerdict(tz)`** lives in the Parking lot `Screen` and holds at most one verdict, in a ref.
     - `hold(idea, verdict, note)` dates it now, in the zone. It sets the idea's override to `heldIdea(…)`, so the pill, detail and footer change at once. Then it shows the toast with `undo` (cancel) and `onDone` (send).
     - **Send:** `POST /parked-ideas/{id}/verdicts`. Sends are queued, so two quick verdicts arrive in order.
       - **201:** the override becomes the response, then a refresh in a transition.
       - **409:** the override is cleared, `CHANGED_ELSEWHERE` shows, and the page refreshes.
       - **Other failures:** the override is cleared, and `VERDICT_NOT_SAVED` shows under the verdict control.
     - **Undo:** clears the ref and the override, then says `UNDONE`. If the verdict was already sent, it says `ALREADY_SENT`.
     - **Leaving:** `pagehide` sends the held verdict with `fetch(..., { keepalive: true })`. Unmounting the screen (an in-app navigation) sends it at once. Whichever comes first clears the ref, so it is sent once.
   - **`Verdict`:** **Your verdict**, three buttons, Still parked · Approved · Dropped, in a `role="group"`, with `aria-pressed` on the current one. Still parked and Approved hold their verdict. Dropped opens `DropDialog`.
   - **`DropDialog`:**
     - a quote block with the idea and why it grabbed you;
     - **Why**, up to 280, with the placeholder "What changed since you parked it?";
     - `checkDrop` first (error, shake, focus);
     - the red **Drop it**, which closes the dialog and holds `dropped` with the note.
     - Nothing is sent from the dialog, so it has no `busy`.
8. **Start from an approved idea.**
   - `new/page.tsx` reads `GET /parked-ideas` on the server and passes the approved ideas to `NewObjectiveForm` as `ideas`. Onboarding passes options and no `ideas`, so it shows no card.
   - **`StartFrom`:** two choice cards (radio group) and the search when there's more than one idea. Then a scrolling list (max 300 px), the hint, and the no-ideas line with a link to `/parking-lot`.
   - **Picking an idea** runs `fillFrom`.
   - **Create:** `checkStart` joins `checkDraft`'s errors, in the card's place at the top. The body carries `from_parked_idea_id`.
   - **On 201:** as today. The Parking lot then shows the idea as Taken.
   - **On 422** (the idea was no longer approved, e.g. moved back in another tab): the form stays, and says "That idea is no longer approved. Pick another, or start from scratch." The list is read again.
   - **If the ideas can't be read:** the card shows Scratch only, with "Couldn't reach the Parking lot. You can start from scratch."
9. **TRIAGE.**
10. **Proof** on localhost. The intent's check runs on the deployed service after the merge.

---

## Risks

**What could break**

- **A verdict lost or sent twice (step 7).** Held in the page, it can be lost if the tab closes before it goes, or sent twice if both the timer and the page leaving send it.
- **Verdicts out of order (step 7).** Approve, then Still parked straight away, sends two requests. If the second lands first, the record says Approved.
- **Toast change (step 7).** `toast.tsx` is shared with Today's delete Undo. A wrong `onDone` could fire on that toast, or fire twice.
- **What the page shows against what was saved (step 7).** The idea reads Approved before anything is sent. A failure has to put it back visibly.
- **Onboarding shows "Start from" (step 8).** `NewObjectiveForm` is also onboarding's step 2.
- **Fill overwrites typing (step 8).** Picking a second idea must not replace a Name the user has edited.
- **A flag held in two components (steps 4, 7).** As with Log time's `busy`, a held flag left set would leave the next dialog stuck (Common mistakes).
- **A server page calls a `"use client"` module (steps 3, 8).** The words must live in `modules/parking/domain`, never in a client file (Common mistakes).
- **The wrong day (steps 4, 6, 7).** A page left open overnight would date a park, note or verdict yesterday.
- **Same-day order (step 3).** The API orders by `caught_on DESC, id`, so two ideas caught on the same day come back in id order, and a new one may not sit at the top. The spec keeps the API as is.

**How each risk is handled**

| Risk | Handling | Prevented by | Proved by |
|---|---|---|---|
| Lost or twice | Prevented | One ref; whoever sends first clears it; `pagehide` with `keepalive`; unmount sends | Chrome: approve then close the tab; approve then click Today; approve and wait. One `verdicts` row each (Network panel, then the list) |
| Out of order | Prevented | Sends queued; a new hold first sends the one before (the replaced toast's `onDone`) | Chrome: Approve then Still parked quickly. Ends Parked after reload |
| Toast change | Prevented | `onDone` is optional, stored on that toast only, called once; Today passes none | Chrome: Today's delete Undo still undoes; verdict toasts fire once |
| Shown vs saved | Prevented | The override is cleared on failure, with `VERDICT_NOT_SAVED`; a 409 refreshes | Chrome: block `verdicts`, approve, wait. Back to Parked with the error |
| Onboarding card | Prevented | The card renders only with `ideas`, which only `new/page.tsx` passes | Chrome: `/welcome` step 2 has no card |
| Fill overwrites | Prevented | `fillFrom` compares with what the previous pick filled | `startFrom.test`: edited Name kept, untouched Why replaced |
| Flag in two places | Prevented | `busy` lives once, in `ParkIdeaProvider`; Drop has none | Chrome: park, then open again. × and Esc work |
| Client module on server | Prevented | Words in `modules/parking/domain` only | `npm run build`, then load both pages |
| Wrong day | Prevented | `localDayOf(new Date(), tz)` at send time | `parkIdea.test`, `parkingView.test` build bodies from a given day |
| Same-day order | Accepted | API unchanged (spec); the new idea is selected and flashes wherever it sits | TRIAGE |

**The riskiest step: 7.** It's the only place where what the page shows runs ahead of
the record, and the only change to a shared component (`toast.tsx`). The mitigations:
- one ref decides whether anything is still held;
- `onDone` is opt-in;
- the override is replaced by the server's answer, or cleared, on every way out;
- the proof covers each way out: Undo, timeout, replacement, in-app navigation, tab close, failure and 409.

**What was not chosen**

- **Sending at once and undoing with a second verdict.** Dropped is final, so it couldn't be undone (G13, kept).
- **`navigator.sendBeacon`.** `fetch` with `keepalive` sends the same JSON with the session cookie, through the same code path.
- **Working out the lock on the page.** It is always `new_idea_locked_until` (G38). With no answer, there's no note.
- **A separate Notes component for ideas.** `Notes` takes the URL; the pattern is shared (01-shell.md).
- **Radio semantics for Your verdict.** Arrow keys would send verdicts as focus moves; buttons with `aria-pressed` don't.
- **Reading the ideas in the browser for "Start from".** The page reads them on the server, like the rest.
- **Changing the API's order** or the review's parked ideas: out of scope.

**Decided, not specified** (for the PR)

- **Drop's Why** is capped at 280, like the other reasons. The design gives no number.
- **Undo's toast** reads "Undone.", or "Already saved; it can't be undone now." after the verdict has left.
- **Failure words:**
  - "Couldn't park it. Nothing was saved. Try again.";
  - "Couldn't save your verdict. Nothing was changed. Try again.";
  - "This idea changed somewhere else. Nothing was changed here.";
  - "That idea is no longer approved. Pick another, or start from scratch.".
- **"Start from" has no default choice.** The design's error "Pick an approved idea, or start from scratch." implies one must be picked. *(Worth Rohit's look: it adds a click to every New objective.)*
- **The lock tooltip's parenthesis** names the objective whose end sets the lock. It's left out when none matches.
- **`P` on Today** works only when Today has objectives, as `D` does. The rail isn't shown otherwise.
- **A filled Name** is cut to 80, Name's limit. An idea can be up to 120.
- **Parking an idea on phone** opens its detail, as Log a deviation does. The flash shows on the list.

---

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | `npm run contract` | Docs only |
| 2 | `parkingView.test`, `parkIdea.test`, `startFrom.test` at 100 % under `test:tz`: <br>• each pill state, early and not; <br>• the tooltip with and without a match; <br>• the Taken line, early and not, objective found or not; <br>• `heldIdea` early on either side of `locked_until`; <br>• the checks with blank, spaces and the limits; <br>• `lockNote` caution, muted and null; <br>• `parkedToast` both ways; <br>• `approvedLine` 0, 1, 2; <br>• `fillFrom` empty, previous pick, edited; <br>• `checkStart`. <br>`newObjective.test`: the body with and without `from_parked_idea_id` | Nothing renders them |
| 3 | Chrome at 1280 and 767 px, ideas made through the API in every state (locked, open, approved, approved early, taken early, dropped): <br>• each pill and detail; <br>• the ⓘ by keyboard, Esc and outside click; <br>• phone back link; <br>• an unknown id goes to the list; <br>• `D` opens Log a deviation; <br>• empty state; <br>• keyboard only | Read only; the placeholder becomes a screen |
| 4 | Chrome: <br>• `P` and both buttons; <br>• the lock note with an objective running (its end date) and with none (grey); <br>• the errors and shake; <br>• 120 and 280 counters; <br>• park: toast words, selected and flashing; <br>• double Enter sends once; <br>• a blocked `POST` keeps the text; <br>• a blocked `GET` drops the note and still parks; <br>• phone bottom sheet | The same API the tests already cover |
| 5 | Chrome: <br>• the rail button and `P` on Today; <br>• `L` and `D` still work; <br>• lands on the Parking lot | — |
| 6 | Chrome: <br>• a note on a locked, an approved, a taken and a dropped idea, newest first; <br>• an objective's notes still save | Open in every state (G3) |
| 7 | Chrome: <br>• Approve: the toast, the pill at once, and one request after 5 s; <br>• Undo: nothing sent; <br>• Approve then Still parked: ends Parked; <br>• Approve, then click Today: sent once; <br>• Approve, then close the tab: sent (check after reopening); <br>• Drop: required error, quote block, Undo, then final line; <br>• an early verdict reads "· early"; <br>• a blocked request: state back and error; <br>• a 409 from a second tab; <br>• Today's delete Undo still works; <br>• keyboard only | The control appears with the send that backs it |
| 8 | Chrome: <br>• no approved ideas: line and link; <br>• one: no search; three: search filters; <br>• pick fills Name and Why, a second pick replaces them, an edited Name is kept; <br>• nothing chosen: the error; <br>• create: the idea reads "Taken {today}", early if locked, "Runs …"; <br>• `/welcome` step 2 unchanged; <br>• the 422 path with the idea moved back in another tab | Without `ideas` the form is as before |
| 9 | — | Docs only |
| 10 | After the release, the intent's check on the deployed service | — |

**Test data:** ideas are made through the API on a local account, as in I-14 and
I-15. That gives one idea caught while an objective runs (locked) and one caught with
nothing running (open). A past `caught_on` with an objective that has since ended gives
open-since. Approved, early and dropped ones are made through `verdicts`, and a taken one
through `POST /objectives`. Failures come from blocking the request in Chrome.

**TRIAGE (step 9):**
- Remove "`D` on the Parking lot · found in I-12". Step 3 does it.
- Add: "`GET /parked-ideas` orders ideas caught on the same day by id, not by when they were parked". Fixing it needs `recorded_at` in the order: a repo change, with no contract change.

---

## Changed after acceptance

Asked for by Rohit on 2026-11-04, after the build was checked on localhost. Each is
recorded in `07-parking-lot.md`, which owns the design:

- **The status filter.** All · Parked · Approved · Taken · Dropped, with counts from the
  list, above it, kept in `?status=` as on Deviations. The design had said "No status
  filter". `filters`, `inFilter`, `filterOf` and `emptyFilter` are in `parkingView.ts`.
- **No ⓘ in a row.** A locked row reads "Locked · opens 9 Jan 2027"; the ⓘ stays in the
  detail.
