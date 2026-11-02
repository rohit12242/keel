# Plan — I-13 · Reviews: weekly and monthly

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-11-02 · **Written:** 2026-11-02

## Context

The API can already start, autosave, judge in, save, discard and list reviews
(I-03), but nothing on screen calls it. An objective has Overview, Effort and
Deviations tabs and no Reviews tab. Its Overview has no banner for a due review.
This intent builds the Reviews tab, the due banner, the weekly or monthly review
and the saved review (`05-reviews.md`; G6, G7, G10, G19–G21) from the API as it
stands. There is one exception, G47: a read change in the API so that a draft's
verdicts stay inside the draft. The contract already says so (`Deviation.verdict`,
`discardReview`, in the accepted spec commit), so there is no contract change.

## What the code has today, and what changes

| Today | Where | Becomes |
|---|---|---|
| A verdict reads everywhere as soon as a draft gives it | `DEVIATION_COLUMNS` (`deviations/repo.ts`), `present` (`deviations/service.ts`), `assembleReview` | Outside its review, a verdict reads only once that review is saved (G47). The write rules still see every verdict |
| The review endpoints exist and nothing on screen calls them | `src/app/v1/reviews/**`, `…/objectives/[objectiveId]/reviews` | Read and written as they are |
| No review types in the DTOs | `src/shared/contract.ts` | `ReviewSummary`, `Review`, `DueReview`, `ReviewList` added, matching the contract |
| Tabs: Overview · Effort · Deviations n; the tab lives in state only | `objectives/ObjectiveDetail.tsx` | And **Reviews n** (saved count). `?tab=reviews` opens it, so the page can return to it after a save or a discard |
| Overview opens with the status banner | `ObjectiveDetail.tsx` `Overview` | The due-review banner above it, when a review is due |
| No review address | — | `/objectives/{id}/reviews/{reviewId}`: the draft as a form, or the saved review read-only |

**Reused, not copied:**
- **Words for dates and time:** `dayLabel`, `duration` (`newObjective.ts`); `total`, `compact` (`todayView.ts`); `scheduleLine` (`objectiveView.ts`); `mondayOf` (`effortMonth.ts`); `localDayOf` and `localTimeOf` (`shared/time/localDay.ts`) for "5 Sep, 18:40" in the user's zone.
- **Adherence colour:** `trackOf` (`effort/domain/track.ts`), the bands So far uses.
- **Screen parts:** `Dialog` and `dialogParts`; `CountedLabel`, `FieldError`, `describedBy`, `errorIdOf` (`form.tsx`); `useToast`; `readApi`; `requireUser`; `todayFor` and `zoneOf`; `Pill` and `TONE` (`ObjectiveDetail.tsx`); `BackIcon`.
- **The send-once pattern:** Log time's and Log a deviation's `sending` ref, cleared on every way out (Common mistakes).
- **The objective-page reads:** the shape of `objectives/deviations.ts`, with a failed read as a value rather than a throw.

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/intents/I-13-reviews/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 2 | `modules/deviations/repo.ts`, `service.ts`; `deviations/domain/verdictView.ts` *(new, + test)*; `modules/reviews/domain/assembleReview.ts` (+ test), `service.ts`; `modules/today/service.ts`; `deviations.itest.ts`, `reviews/deviation-verdict.itest.ts` | G47, below |
| 3 | `src/shared/contract.ts`; `modules/reviews/domain/reviewView.ts` *(new, + test)*, `reviewForm.ts` *(new, + test)* | The review DTO types, and the pure rules below. Unused yet |
| 4 | `src/app/(app)/objectives/[id]/reviews/[reviewId]/page.tsx` *(new)*; `objectives/review/SavedReview.tsx`, `Numbers.tsx`, `ReviewHead.tsx`, `review.module.css` *(new)* | The saved review, read-only: head, lock note, previous and next, the four cards. Reachable by its address only |
| 5 | `objectives/review/ReviewForm.tsx`, `useAutosave.ts`, `DiscardDialog.tsx` *(new)*; `[reviewId]/page.tsx`; `review.module.css` | The draft as a form: the four cards, autosave and **Save draft**, verdicts, **Save review**, **Discard draft**. Still reachable by its address only |
| 6 | `objectives/reviews.ts` *(new)*, `ReviewsTab.tsx` *(new)*; `ObjectiveDetail.tsx`, `Screen.tsx`, `page.tsx`, `[id]/page.tsx`, `objectives.module.css` | The objective's Reviews tab with its count, `?tab=`, and the Overview's due banner. **Start review** and **Continue draft** open the page from step 5 |
| 7 | `docs/intents/TRIAGE.md` | Close "No screen discards a review draft"; add the findings below that fall outside this intent |

All `objectives/…` paths are under `src/app/(app)/`.

### G47, the read change (step 2)

- `DEVIATION_COLUMNS` gains `verdict_saved`, which is true when `verdict_review_id` names a review with `status = 'saved'`. It's one `EXISTS` on the review's primary key. `DeviationRow` carries it; the contract's `Deviation` never shows it.
- `verdictView.ts`: `seenVerdict(row, inReview: string | null)` returns `verdict` and `verdict_review_id` as stored when the review that gave them is saved, or when that review is `inReview`. Otherwise it returns both as null.
- Where it applies, at the response edge only:
  - `GET /deviations` and Today's `last_deviation` use `inReview = null`;
  - a review's own `deviations` use `inReview = review.id`;
  - `PUT …/deviation-verdicts/…` returns the deviation as seen from that review.
- Where it does **not** apply: `verdictDecision` and `saveDecision` keep reading the stored verdict. Hiding it there would let a second draft overwrite a verdict that a first draft (of another objective the deviation names) already gave. The 409 must still come back.
- Discard already clears a draft's verdicts (`deleteDraft`); this step only adds tests that prove it.

### The pure rules (step 3)

**`reviews/domain/reviewView.ts`** (every place that shows a review)
- **The tab:**
  - `dueCards(due, reviews, tz, today)` gives one card per due window, oldest first. Each card has:
    - the label, "Week 2 review";
    - the period, "Mon 31 Aug – Sun 6 Sep";
    - "Draft saved" and "· last edited 5 Sep, 18:40", when the draft's `last_saved_at` is set;
    - its action. The first card gets **Start review** or **Continue draft**. Each later card gets "Opens after Week 1". A `plan_end` card has no button and says "Opens in a later release." *(Rohit, 2026-11-02)*
  - `savedRows(reviews, tz)` gives the saved reviews newest first, as "Week 1 · Mon 24 – Sun 30 Aug", "Change: '…'", the adherence % and its tone, and the saved date. More than 8 rows are grouped under month headings: the newest 8 show, then "Show 17 earlier reviews".
  - `emptyLine(o)`: "No reviews yet. The first one is due Sun 30 Aug.", from `upcoming_review_on`.
  - `tabCount(reviews)`: the number of saved reviews.
- **The banner,** `dueBanner(due, reviews, today)`:
  - "Week 2 review is due" or "Final review is due";
  - "2 reviews due · draft saved", or "· the plan ended Fri 4 Sep";
  - **Start review** or **Continue draft**, or the `plan_end` hint with no action;
  - null when nothing is due.
- **The review page:**
  - `reviewHead(review, o, tz, today)` gives the title, "Week 2 review"; the sub-line, "Mon 31 Aug – Sun 6 Sep · {title}" (a saved review adds `scheduleLine`); and the pill: "Draft saved · 5 Sep, 18:40", "Due Sun 6 Sep" or "Saved Sun 30 Aug, 19:10".
  - `tiles(review, previous)` gives five tiles from `figures` and the review's deviations:
    - Adherence, with its tone;
    - Logged, "of 12h 00m planned · +30m over";
    - Targets met, "3 of 6";
    - Deviation time, summed over the review's own `deviations`;
    - Extra, off days.

    With a previous **saved** review, every tile but Logged gets the hint "90% in week 1", and the card's hint is "Week 1 for comparison". Without one, those tiles get no hint.
  - `dayBars(grid, period)` for a weekly review gives one column per day, from the grid's `state`, `logged_minutes` and `target_minutes`. Each has the value on top, the target line, the height capped, and the word: ✓ Met · ✓ +30m · − 1h 15m · ✕ Missed · + Extra · Off day.
  - `monthWeeks(grid, period)` for a monthly review gives one row per Monday-to-Sunday week, clipped to the month, with logged and planned time summed from the same days.
  - `chosenBlocks(review)` gives the Chosen deviations of the period, and `driftedCount` gives the hint "1 Chosen · 0 Drifted this week". A Chosen deviation judged by another review shows that verdict, locked.
  - `IMPROVEMENT` maps the answers to the design's words: `yes` → Worked, `partly` → Partly, `no` → Didn't work, `not_tried` → Didn't try it. `VERDICT` maps `worth_it` → It held and `not_worth_it` → It didn't hold.
- **The saved review:**
  - `neighbours(review, list)` gives the previous and next saved reviews. A disabled button says why: "No earlier review", "Week 2 · still a draft", "Week 3 · not saved yet", or "No later review".
  - `checkedIn(review, list)` gives "Checked in the week 2 review" when a saved review answers this one, and "To check in the week 2 review" when the next window is known (a draft or due). Otherwise it gives "To check at the next review."

**`reviews/domain/reviewForm.ts`** (the draft)
- **Answers:** `improvement_answer`, `what_worked`, `what_got_in_the_way` and `what_changes_next`, 280 characters each (G7; the contract allows 4000). `answersOf(review)` and `patchBody(answers)` convert between the review and these answers.
- `checkReview(answers, verdicts, review)` returns every error in the design's words, in page order, with the first one to scroll to:
  - "Say how last change went.", only when there's a change to check;
  - "Mark whether the reasoning held.", for each Chosen deviation still to judge;
  - "Write what worked, even if it was small.";
  - "Write what got in the way.";
  - "Set one change to try next."
- **The words:**
  - `savedToast(label, moreDue)`: "Week 2 review saved." and, when more are due, " 1 more due." or " 2 more due.";
  - `DRAFT_SAVED`: "Draft saved. Continue it from Reviews.";
  - `DISCARD_ASK`: "Discard this draft? Its answers are deleted, and the review stays due.";
  - `DISCARDED`: "Draft discarded. The review is still due.";
  - `NOT_SAVED`: "Couldn't save the review. Your answers are kept as a draft. Try again."

---

## Order of work

1. **Accept the plan.** `plan.md` committed alone.
2. **G47**, as above, with unit tests at 100 % and itests. It's the only server change, and it lands before any screen relies on it.
3. **The pure rules and DTO types**, at 100 % coverage (ADR-007). Unused yet.
4. **The saved review, read-only.** The page reads, on the server:
   - first, `GET /reviews/{reviewId}`. A 404 goes to `/objectives/{id}`. An `objective_id` that differs from `{id}` redirects to the right address;
   - then, in parallel:
     - `GET /objectives/{id}`;
     - `GET /objectives/{id}/reviews`;
     - `GET /objectives/{id}/schedule?from&to` over the period;
     - `GET /reviews/{previous_review_id}`, when there is one.

   `Numbers.tsx` (the tiles, then the bars or the month's week rows) and `ReviewHead.tsx` are written here and reused in step 5. A failed grid read shows `READ_FAILED` in place of the bars, and the rest still renders. A failed previous read leaves the hints out. A `plan_end` review at this address shows "This screen isn't built yet."
5. **The draft.** It's the same address: a draft renders `ReviewForm`, and a saved review renders `SavedReview`. Then:
   - **Choices** (How did it go?, It held / It didn't hold) are radio chips: arrow keys move between them, Space picks one. How did it go? autosaves at once. A verdict is a `PUT` at once; on failure it reverts and says so under the deviation. A 409 shows "An earlier review already judged this deviation."
   - **Typing** autosaves one second after it pauses (`useAutosave`). There is one `PATCH` in flight at a time: newer answers wait and go next, so an older write never lands last. On `pagehide` anything pending goes with `keepalive`. The pill shows `last_saved_at` from the latest response (G10).
   - **Save draft** flushes now and shows the toast `DRAFT_SAVED`. It stays on the page.
   - **Save review:**
     - `checkReview` runs first. Every error shows at once, the page scrolls to the first and focuses it, and nothing is sent;
     - then the `sending` ref, the pending `PATCH` flushed, and `POST /reviews/{id}/save`;
     - on 200, `router.push('/objectives/{id}?tab=reviews')` and `savedToast`. "More due" is the page's `due` count minus this review;
     - on failure, the ref is cleared, everything typed stays, and `NOT_SAVED` shows as a banner over the sticky bar.
   - **Discard draft** shows once `last_saved_at` is set or a verdict has been given. It opens `DiscardDialog` (Cancel, red **Discard**), sends `DELETE /reviews/{id}`, then goes to `?tab=reviews` with `DISCARDED`. If the delete fails, the dialog stays open and says so.
6. **The Reviews tab and banner.** `readReviews(id)` (`objectives/reviews.ts`) runs in parallel with the objective's first reads, on both `objectives/page.tsx` and `[id]/page.tsx`. Then:
   - the label reads "Reviews 3";
   - the Overview's banner and the tab come from the same read;
   - **Start review** sends `POST /objectives/{id}/reviews` with no body, so the server picks the oldest due window (G-05). Then `router.push` to the review. It sends once, and a failure shows under the button;
   - **Continue draft** is a link to the draft's address;
   - `?tab=reviews|effort|deviations` picks the open tab, and the arrow keys work as before.

   If the read fails, the label reads "Reviews", the tab shows "Couldn't load reviews. Try again.", and there's no banner.
7. **TRIAGE.**
8. **Proof** on localhost. The intent's check runs on the deployed service after the merge.

No migration, no infra, no dependency, no contract change.

---

## Risks

**What could break**

- **Verdicts (step 2).** This changes a live read: the Deviations page, the objective's Deviations tab, and Today's card. Hiding a verdict in the wrong place has two failure modes:
  - in the API's write rules, a second review could overwrite a verdict, or a save could pass without one;
  - in the review's own response, a draft's verdicts would vanish from that draft, and leaving and coming back would lose them.
- **Autosave (step 5).** Writes that reorder, a write lost when the user leaves, and a `PATCH` racing **Save review** so that the review is saved without its last words.
- **Sent twice (steps 5, 6).** A double click or Enter on Save review, Start review or Discard.
- **Saved means fixed.** Nothing on the saved page may write. Only a `draft` renders the form; the API's 409 is the second guard.
- **Figures that disagree.** The tiles are the API's `figures`, and the bars are the schedule grid. The two must agree, so step 4's proof compares them. Deviation time sums the review's own list, which is the I-12 rule.
- **The objective pages (step 6).** They gain one read. It runs in parallel, so the page's latency doesn't grow by a round. If the read fails, the page must still render.
- **The wrong review opens.** The page never names a window. Start sends no body, and due windows, labels and periods come from G19, so there's no window rule on the page.
- **Phone.** The tiles go two by two and the bars compress. The sticky bar sits above the tab bar and drops its text. The saved rows drop the bar and the date.

**How each risk is handled**

| Risk | Handling | Prevented by | Proved by |
|---|---|---|---|
| A verdict hidden from a rule | Prevented | `seenVerdict` only at the response edge; decisions read the stored row | `deviation-verdict.itest.ts`: a second draft still gets a 409 |
| A draft's verdict leaks | Prevented | `verdict_saved`; `inReview` null outside the review | itests: `GET /deviations` and `/day` before and after the save, and after a discard |
| Autosave reorders or is lost | Prevented | One `PATCH` in flight, the latest answers next; `keepalive` on `pagehide` | Chrome with throttling: type, leave, come back |
| Save without the last words | Prevented | Save flushes and awaits the `PATCH` before the `POST` | Chrome: type and Save review at once, then the saved page shows the text |
| Sent twice | Prevented | A `sending` ref, cleared on every way out | Chrome: a double click sends one request |
| Tiles and bars disagree | Prevented | Both from the API; nothing recomputed | Chrome: logged on the tile equals the sum of the bars |
| Reviews read fails | Prevented | `Read` value, not a throw | Chrome with the request blocked |
| One more read per objective view | Accepted | It runs in parallel, and the tab label needs it | — |

**The riskiest step: 5.** It's the only step that writes, and it writes four ways:
`PATCH` while typing, `PUT` per verdict, `POST` save and `DELETE` discard. They have
ordering rules between them. Mitigations:
- Every check, body and word is in `reviewForm.ts`, tested at 100 % before the form exists.
- The form is reachable only by its address until step 6. Drafts for it are made through the API, so no live screen changes in step 5.
- `useAutosave` holds the ordering rule in one place, and Chrome proves it with throttling.

**What was not chosen**

- **The final review.** It shows as due, with "Opens in a later release." and no button. Nothing creates a `plan_end` draft from a screen.
- **Moving "Draft saved" on a verdict.** The `PUT` returns the deviation, not the review, and making it touch `last_saved_at` would be an API change outside G47. The verdict is still saved at once.
- **A client-side window rule.** Labels, periods and "due" come from the API (G19), even "Opens after …".
- **The improvement note** (`improvement_answer_note`) and **`review_summary`.** The design has no field for either.
- **Parked ideas in the review.** The design leaves them out (TRIAGE, I-03).
- **A loading page for the review.** It's server-rendered, the same choice as I-11 and I-12.
- **Shortcuts.** The design names none for reviews.

**Decided, not specified** (for the PR)

- **Addresses:**
  - a review is at `/objectives/{id}/reviews/{reviewId}`, so Objectives stays the current place;
  - the tab is `?tab=reviews`;
  - an unknown review goes to the objective.
- **"Draft saved",** **Continue draft** and **Discard draft** show once `last_saved_at` is set (or a verdict was given). A draft row that was opened and never written reads as **Start review**.
- **Logged never compares** with the previous review. Its hint stays "of … planned · … over".
- **"recorded 2 Sep"** is left out of the reasoning block, as in I-12: there's no recorded date (TRIAGE).
- **A Chosen deviation judged by another review** shows that verdict, locked, and isn't counted as one to judge.
- **The next change when the next window is unknown:** "To check at the next review."
- **The failure words:**
  - Save: "Couldn't save the review. Your answers are kept as a draft. Try again.";
  - a verdict: it reverts, with the error under the deviation;
  - Discard: the dialog stays open and says so.

---

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | — | Docs only |
| 2 | `verdictView.test.ts` and `assembleReview.test.ts`: saved, draft, the same draft, another draft, none. itests (CI):<br>• a draft's verdict is absent from `GET /deviations` and `GET /day/{date}`, and present in `GET /reviews/{id}`<br>• after the save, it's present everywhere<br>• after a discard, it's gone from both<br>• a second objective's draft still gets a 409 | Today, Deviations and the objective tab read the same fields; only a draft's verdict stops showing, which is what the contract already says |
| 3 | `reviewView.test.ts` and `reviewForm.test.ts` at 100 %:<br>• due cards for one, two and a `plan_end`, with and without a draft<br>• saved rows at 8 and 9, the month groups<br>• empty line; banner words<br>• tiles with and without a previous review<br>• bars for every state and over target; month weeks clipped at both ends<br>• neighbours' disabled reasons; `checkedIn` in each case<br>• every error, in order; "1 more due", "2 more due"<br>Under `test:tz` | Unused |
| 4 | Chrome at 1280 and 767 px on a weekly and a monthly review saved through the API:<br>• head and pill; lock note<br>• previous and next, enabled and each disabled reason<br>• tiles, hints, bars or week rows, and their sum against Logged<br>• answers and verdict pills; "Checked in …"<br>• the grid read blocked | A new address that nothing links to yet, and it only reads |
| 5 | Chrome on drafts made through the API:<br>• each card, the first review's "Nothing to check", none Chosen<br>• autosave, leave and come back, with verdicts kept<br>• Save draft; every error at once, with scroll and focus<br>• Save review: one POST on a double click; the toast; the saved page reads back unchanged<br>• the save blocked: the banner, nothing lost<br>• Discard: Cancel, then Discard; the toast; the window owed again<br>• keyboard only on the radio chips | Reachable only by address |
| 6 | Chrome on an account with a weekly objective owing two reviews and a monthly one:<br>• "Reviews n" with arrow keys; `?tab=reviews`<br>• the banner opens the oldest; the second waits with "Opens after …"<br>• a paused objective shows nothing due<br>• a `plan_end` due shows the hint and no button<br>• more than 8 saved, via the API<br>• the read blocked: the page renders and the tab says so<br>• the phone layout<br>• the Deviations page shows the verdict only after the save | — |
| 7 | — | Docs only |
| 8 | After the release, the intent's check on the deployed service | — |

**Test data:** everything Chrome needs can be made through the API on a local
account. To make windows close, an objective is created with a start date in the
past: weekly, from four weeks ago, and monthly, from two months ago. Entries can
only be logged for today (G21), so past days show as missed. A past window with
logged minutes is proved by unit tests and itests, not in Chrome.

**TRIAGE (step 7):**
- close "No screen discards a review draft", as built;
- add "A deviation naming two objectives can be judged by one objective's draft, and a save of the other's review passes on that unsaved verdict": `saveDecision` counts it as judged, and a later discard leaves the saved review with a Chosen deviation unjudged.
