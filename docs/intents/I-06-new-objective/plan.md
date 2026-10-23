# Plan — I-06 · New objective

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-10-23 · **Written:** 2026-10-23

## What the code has today, and what changes

| Today | Where | Becomes |
|---|---|---|
| The contract allows `runs_for_days` up to 366 (G42, accepted with the spec); the code still refuses 366 | `validateObjectiveWrite.ts:110` | 1–366. `validateExtension.ts` keeps 365 |
| Objectives is a placeholder with a header | `src/app/(app)/objectives/page.tsx` | The same placeholder, plus **+ New objective** (**+ New** on phone) in its header |
| No way to start an objective in the UI | — | `/objectives/new`, the design's page without the "Start from" card |
| A toast lives in the sign-in screens only (4 s, its own CSS) | `(auth)/ui.tsx` `useToast`, `auth.module.css .toast` | One toast for the whole app (`src/app/toast.tsx`), 2.8 s as `01-shell.md` sets it, above the tab bar on phone; the sign-in screens use it |
| Today picks its day with the **server's** clock (`toLocaleDateString` on ECS, so UTC) | `(app)/(today)/page.tsx:52` | Today shows the **browser's** day (Rohit's decision, 2026-10-23): without `?date=`, it hands over to a small client step that replaces the URL with `/?date=<browser day>`, keeping `reset=done` |

**Rules the page reuses, not copies** (the spec's "same rules the server uses"):
`reviewWindows` and `addMonths` (`src/modules/reviews/domain/reviewWindows.ts`) for the
review count, the last review and how long *n* months is; `generateSlots`
(`objectives/domain/generateSlots.ts`) for Planned days; `localDayOf`
(`src/shared/time/localDay.ts`) for the browser's day. The page's checks are written
so that whatever passes them also passes `validateObjectiveWrite`. A test proves it.

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/intents/I-06-new-objective/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 2 | `src/modules/objectives/domain/validateObjectiveWrite.ts` (+ test), `src/modules/objectives/create-objective.itest.ts` | `runs_for_days` 1–366, as the contract already says. Tests: 366 accepted, 367 refused, and 12 months from 2027-03-01 (ends 2028-02-29, 366 days) created; an extension of 366 is still refused |
| 3 | `src/app/toast.tsx`, `src/app/toast.module.css` *(new)*; `(auth)/layout.tsx`, `ui.tsx`, `auth.module.css`, `CreateAccountForm.tsx`, `ResetPasswordForm.tsx`; `(app)/layout.tsx` | `ToastProvider` + `useToast().show(text)`: one live region, bottom centre, `--text` on `--on-text`, 14 px, 2.8 s, `bottom: calc(var(--size-tabbar) + 16px)` at ≤ 860 px. The provider sits in both layouts, so a toast survives a client navigation inside the frame. The auth copy (`useToast`, `.toast`) is removed |
| 4 | `src/modules/objectives/domain/newObjective.ts` *(new, + `newObjective.test.ts`)* | Pure rules for the page, described below |
| 5 | `src/app/(app)/PageHeader.tsx`, `shell.module.css`, `objectives/page.tsx` | `PageHeader` takes an `action` (desktop) and a `phoneAction`; on phone the action sits left of the avatar. Objectives passes a link **+ New objective** / **+ New** to `/objectives/new` |
| 5 | `src/app/(app)/objectives/new/page.tsx`, `NewObjectiveForm.tsx`, `newObjective.module.css` *(new)* | The page: **‹ Objectives**, title, the cards **What it is**, **Schedule**, **Plan** with the preview, and the sticky footer (**Cancel**, **Create objective**). Choice cards and chips are `role="radio"` / `role="checkbox"` buttons; Weeks/Months and Week/Month are `aria-pressed` segments, as in the prototype. Counters `0/80`, `0/280`. Hours, minutes and length take digits only. Defaults are the prototype's: Fixed, Mon–Fri, 1h 00m, flexible 3 days, starts Tomorrow, 4 weeks, weekly reviews. Create checks the form but does not send yet |
| 6 | `NewObjectiveForm.tsx`, `newObjective.module.css` | The checks shown as `01-shell.md` sets out: under the field with the icon, field border `--deviation`, one shake (off under reduced motion), focus on the first bad field, each error cleared when its field is edited |
| 7 | `NewObjectiveForm.tsx` | Create sends `POST /v1/objectives` once (a ref guard plus `disabled`/`aria-busy` "Creating…"). 201 → `show(createdMessage)` and `router.push("/")`. 401 → Sign in. Anything else → a banner "Couldn't create the objective. Nothing was created. Try again.", with every field kept |
| 7 | `src/app/(app)/(today)/page.tsx`, `src/app/(app)/(today)/BrowserDay.tsx` *(new)* | Without `?date=`, Today renders its loading state and `BrowserDay`, which reads `localDayOf(new Date(), browser zone)` and does `router.replace("/?date=…")`, keeping `reset`. With a `?date=` in the `YYYY-MM-DD` shape, Today renders as now. A `?date=` of any other shape is treated as missing. Today puts `date` into the fetch path unchecked, so `?date=../objectives` resolves to `/v1/objectives` and the page 500s on the wrong JSON |
| 8 | `docs/intents/TRIAGE.md` | Findings outside this intent (two below already known) |

### `newObjective.ts`, the page's rules

- `startChoices(today)` → Today, Tomorrow, Next Monday (a Monday gives the Monday after).
- `runsForDays(start, n, "weeks" | "months")` → weeks × 7; months = days to `addMonths(start, n) − 1`, inclusive.
- `perDayShare(weekMinutes, days)` → `ceil(weekMinutes / days)` (G40).
- `preview(draft, today)` → starts on, ends on, Planned days (`generateSlots` count) or Days a week, Each week (fixed: target × days; flexible: share × days), Reviews (`reviewWindows(...).length`), last review on (= end).
- `checkDraft(draft)` → errors by field in the design's words, in page order (name, why, criteria, days, target, length), or the `ObjectiveWrite` body: trimmed text, `starts_on`, `tz`, `runs_for_days`, `review_cadence`, schedule with `minutes_per_planned_day` = target (fixed) or the share (flexible).
- Target checks, fixed: 0 → "Set a target above zero."; minutes > 59 → "Minutes go up to 59."; < 15 → "Set at least 15 minutes a day."; > 16 h → "Keep a daily target under 16 hours." Flexible: the same first two, then < 15 × days → "Set at least 45m a week, 15 minutes for each day." with that week's figure, > 16 h × days → "Keep a weekly target under 48 hours, 16 for each day." with that week's figure.
- `dayLabel(iso, today)` → "Sun 6 Sep", with the year when it isn't today's year ("Tue 5 Jan 2027"); `duration(m)` → "2h 06m" / "45m"; `createdMessage(start, today)` → "Objective created. It starts today." / "… It starts Sun 6 Sep."

## Order of work

1. **Accept the plan.** `plan.md` committed alone.
2. **12 months across a 29 February** (G42). The code catches up with the contract.
3. **One toast.** The sign-in screens move onto it; the app gets its provider.
4. **The page's pure rules.** Nothing uses them yet.
5. **The page, and the way to it.** Every field, the preview, Cancel and back. Create checks but doesn't send.
6. **Mistakes shown as designed.**
7. **Create, and Today on the browser's day.** The first write from the UI.
8. **Proof** on localhost, then TRIAGE. The deployed run follows the merge.

No migration, infra or dependency change. The only contract change (G42) is already in
`docs/keel-api.yaml` from the spec commit.

---

## Risks

**What could break**

- **The page and the API disagreeing.** If a check on the page is looser than
  `validateObjectiveWrite`, Create fails with a 400 the person can't fix. A check
  that's stricter refuses a plan the API would take.
- **Planned days and Reviews in the preview drifting from what's stored.** Avoided
  by calling the server's own functions, but only if the page feeds them the same
  `end_date` the server computes (`starts_on + runs_for_days − 1`).
- **Today's hop.** Every visit to `/` without `?date=` costs one extra render. A
  wrong replace could loop, and `reset=done` could be lost.
- **The sign-in screens' toast (step 3).** It changes from 4 s to 2.8 s, and its
  position on phone moves from 100 px to tab bar + 16 px, which is the same 100 px.
- **The browser's zone.** `Intl…resolvedOptions().timeZone` could return a name the
  server's `isValidTz` refuses; Create would then 400 on `tz`.
- **The day turning over while the page is open.** The Start dates and the "starts
  today" toast use the day the page computed when it rendered.

**The riskiest step: 7.** It is the first write from the UI and changes how Today
picks its day for everyone. Mitigations: the step-4 test that runs every passing draft
through `validateObjectiveWrite`; one request guaranteed by a ref, not only
`disabled`; `BrowserDay` replaces only when `date` is missing, so it can't loop.

**What was not chosen**

- **The "Start from" card and approved ideas.** Out of scope (spec); the page starts
  at What it is, and `from_parked_idea_id` is never sent.
- **A second copy of the rules in the UI.** Planned days, the review count, months
  and the 12-month bound all come from the domain functions the server uses.
- **Sharing the sign-in screens' field pieces** (`Field`, `FieldError`,
  `described`). They read the auth layout's own surfaces (`--input-bg`), and moving
  them would touch live screens for no gain here. The page has its own, and a TRIAGE
  entry records the two copies.
- **The server knowing the zone on the first request** (a `keel_tz` cookie, the
  sign-in sending the zone to `user.tz`, or CloudFront's viewer time-zone header).
  Each needs a recorded decision, because timezone behaviour is out of v1. The
  sign-in option also touches session code. `?date=` carries the client's own date
  instead. The sign-in zone is the natural follow-up, since it would also close
  TRIAGE's "A new user's zone is UTC".
- **Correcting a `?date=` that is not today.** It stays honoured, for looking at
  another day; only a missing one is filled in. A tab reloaded the next morning shows
  the day in its URL, and the eyebrow says which.
- **Making the reset message a toast.** "Password changed. You're signed in." stays a
  notice on Today; the spec doesn't move it.
- **Keyboard shortcuts and dialogs**, including an `N` for New objective. Out of scope.
- **Exactly 16 h.** The design says "under 16 hours", but the prototype accepts
  16h 00m and refuses anything above. The page follows the prototype.

---

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | — | Docs only |
| 2 | Domain: 366 accepted, 367 refused; 2027-03-01 + 366 ends 2028-02-29. `validateExtension` still refuses 366. itest (CI): `POST` with `runs_for_days: 366` → 201 | The code meets the contract it already declares |
| 3 | Chrome: Create account's and Reset's toasts appear bottom centre, read out (`role="status"`), gone after 2.8 s; at 390 px they sit above where the tab bar would be. `grep -rn "useToast\|\.toast" "src/app/(auth)"` finds only the shared hook's use | No screen loses its message |
| 4 | `newObjective.test.ts`, 100 % (ADR-007): each design message at its boundary (14/15 min, 16h 00m / 16h 01m, minutes 59/60, 52/53 weeks, 12/13 months, flexible 44m/45m over 3 days with "45m" in the words); `perDayShare(125, 3)` = 42 and the week "2h 06m"; Start choices on a Monday, a Sunday and 31 Dec; 1 month from Sat 5 Sep ends Sun 4 Oct; from 31 Jan ends 27/28 Feb; review counts equal `reviewWindows`; planned days equal `generateSlots`. **The contract test:** a grid of passing drafts (both modes, every length bound, both cadences, starts across a 29 Feb) each gives a body `validateObjectiveWrite` accepts, with `end_date` equal to the preview's | Unused code |
| 5 | Build. Chrome 1280 px and 390 px: **+ New objective** / **+ New** opens the page; **‹ Objectives** and **Cancel** go back and `POST` is never sent (network log); every card per the design; the preview follows each change (2h 05m across 3 days reads "2h 06m"); the footer stays in view when scrolled; counters stop at 80/280 | Create does nothing yet |
| 6 | Chrome: submit empty → every message, in the design's words, under its field; focus on Name; editing Name clears only Name's error; `aria-invalid` and `aria-describedby` on each bad field. Contrast of error text ≥ 4.5:1 in both themes | Additive |
| 7 | Chrome, local: one fixed objective starting today → lands on Today with "Objective created. It starts today." and the objective listed; one flexible starting next Monday → "It starts Mon …" and not on Today. `GET /v1/objectives/{id}` returns exactly what was set. A double-click sends one `POST` (network log). With `fetch` made to fail: the banner shows, fields keep their values. An ended session → Sign in. `/` → `/?date=<browser day>`; `/?reset=done` keeps `reset=done`; `/?date=2026-01-01` is left alone; `/?date=../objectives` and `/?date=junk` hop to the browser's day, and no request reaches `/v1/objectives` (server log) | The full feature |
| 8 | GIF of the journey on desktop and phone. After the release: the intent's check on the deployed service | — |

Integration tests run in CI only: the step-2 case, and the existing objectives itests
(nothing else in the backend changes).
