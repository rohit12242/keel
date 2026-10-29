# Plan — I-10 · Onboarding

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-10-29 · **Written:** 2026-10-29

## Context

A confirmed account signs in and lands on an empty Today (TRIAGE, found in I-04). The
design starts a three-step onboarding instead: how Keel works, the first objective,
what it asks of you. The rule is G11 as decided in I-10: onboarding opens instead of
Today for an account with no objective in any status, unless that account skipped it
in this browser. No API or contract change.

## What the code has today, and what changes

| Today | Where | Becomes |
|---|---|---|
| Sign in and confirm both end in `window.location.assign("/")`; Today renders the empty card for an account with nothing on it | `modules/session/browser.ts`, `(app)/(today)/page.tsx` | Unchanged sign-in. **Today decides**: when the day has no objectives, it asks whether onboarding opens and redirects to `/welcome`. That covers the first sign-in and every later visit with one rule |
| Only `/v1/day` is read for Today (NFR-03) | `(today)/page.tsx` | Same. The second read, `GET /v1/objectives?status=all`, runs **only when the day is empty** |
| The frame (`(app)/layout.tsx`) draws the sidebar and tab bar around every signed-in page | `src/app/(app)/` | A new route group `src/app/(onboarding)/` with its own layout: `requireUser`, `ToastProvider`, `FreshOnBack`, and no frame |
| `NewObjectiveForm` owns its draft, ends in a toast and `router.push("/")`, and has a Cancel link | `(app)/objectives/new/NewObjectiveForm.tsx` | The same form, with optional props: the starting draft, the draft held by the caller (so **Back** keeps what was typed), what happens on 201 (step 3 instead of Today), the left-hand footer control (**Back** instead of Cancel), and an extra block under the success-criteria hint (the phone's hard/easy examples). With no props it behaves exactly as now |
| No "skipped" record anywhere | — | A cookie, `keel_onboarding_skipped`, written by the browser like `keel_theme`: the ids of the accounts that skipped in this browser |
| TRIAGE: "A confirmed account lands on Today, not onboarding" | `docs/intents/TRIAGE.md` | Removed, as closed entries are |

**Reused, not copied:** `NewObjectiveForm` and every rule in `objectives/domain/newObjective.ts`
(`checkDraft`, `preview`, `dayLabel`, `duration`); `requireUser`; `FreshOnBack`;
`KeyHint` from `PageHeader.tsx`; `ObjectivesIcon`, `TodayIcon`, `DeviationsIcon`,
`ParkingIcon` from `src/app/icons.tsx`; the theme cookie's shape (`themeCookie`,
`modules/shell/domain/shell.ts`); Today's fetch-the-endpoint-with-the-request's-cookie
pattern (`fetchDay`, D-04); `upcoming_review_on` on the created objective for **First
review** (G34).

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/intents/I-10-onboarding/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 2 | `src/modules/onboarding/domain/onboarding.ts` *(new, + test)* | The pure rules, below. Nothing uses them yet |
| 3 | `src/app/(app)/objectives/new/NewObjectiveForm.tsx`, `newObjective.module.css` | The form's optional props. New objective passes none and is unchanged |
| 4 | `src/app/(onboarding)/layout.tsx`, `welcome/page.tsx`, `welcome/Onboarding.tsx`, `welcome/onboarding.module.css` *(new)*; `src/app/onboarding.ts` *(new, server)* | The three steps at `/welcome`, reachable by URL only. `src/app/onboarding.ts` is the one server check both Today and `/welcome` call: the skip cookie, then `GET /v1/objectives?status=all` |
| 5 | `src/app/(app)/(today)/page.tsx`; `docs/intents/TRIAGE.md` | Today redirects an empty account to `/welcome` when the check says so. The TRIAGE entry goes |

### The pure rules (`onboarding/domain/onboarding.ts`)

- `ONBOARDING_DRAFT`: every day, 0 h 45 m, starts today, 4 weeks, weekly (design).
- `SKIP_COOKIE`, `skippedBy(value, userId)`, `skipCookie(value, userId, secure)`: a
  list of account ids, newest kept, at most 20, a year's max-age. Malformed values read
  as "nobody skipped".
- `opens({ objectives, skipped })` → whether onboarding opens. `objectives` is a
  count, or `"unknown"` when the read failed; unknown never opens it, so a failed read
  shows Today, never a loop.
- `firstObjective(objective, today)` → step 3:
  - the lead: "starts today." or "starts Sun 6 Sep."
  - the plan line: "Fixed · Every day · 45m a day · weekly reviews · Sat 5 Sep – Fri 2 Oct" (also "Mon–Fri" and "Mon, Wed, Fri")
  - the three tiles: *Today* "Day 1 of 28" or *Starts* "Sun 6 Sep"; *Planned today* "45m" or "Off day"; *First review* from `upcoming_review_on`

## Order of work

1. **Accept the plan.** `plan.md` committed alone.
2. **The pure rules**, at 100 % (ADR-007).
3. **The form takes options.** No visible change to New objective.
4. **`/welcome`, the three steps**, built against the design, desktop and phone. Nothing sends anyone there yet.
5. **Today opens onboarding.** It closes the TRIAGE entry.
6. **Proof** on localhost. The intent's check runs on the deployed service after the merge.

No migration, no infra, no dependency, no contract change.

---

## Risks

**What could break**

- **Every empty account's landing page (step 5).** A wrong decision strands someone:
  - in onboarding when they have objectives;
  - in a loop between Today and `/welcome`;
  - on Today when they should be onboarded.
- **New objective (step 3).** A live page's form gains props. With none passed, it must look, check and create exactly as now.
- **An objective created twice.** Double clicks, a reload of step 3, the browser's back button after **Go to Today**.
- **Today getting slower (NFR-03).** Only an account with an empty day may pay for the second read.
- **The skip cookie.**
  - It must stay per account: a second account on the same browser is still onboarded.
  - It holds account ids in a cookie the page can read. Ids are not secrets, and every query still filters by the session's user (NFR-10).
- **Step 3 says something the objective doesn't.** The first review must come from the
  objective (G34), never a second rule. The plan line and tiles come from the 201 body
  only.
- **The browser's day vs the server's.** The form uses the browser's day and zone, as New objective does (NFR-12). Step 3's "Day 1" uses the same day the form sent.
- **A session that ends mid-onboarding.** A 401 on Create goes to Sign in, as New objective does.
- **Phone.** The pinned primary button, and Skip under it on step 1. The sticky form bar on step 2 must not cover the last field. Checked at 390 px in Chrome only; a real phone is the release check.

**How each risk is handled**

| Risk | Handling | Prevented by | Proved by |
|---|---|---|---|
| A loop between Today and `/welcome` | Prevented | One function decides for both, `src/app/onboarding.ts` over `opens`. `/welcome` sends to Today on anything but "opens", including a failed read | `onboarding.test.ts` (the decision table); Chrome: an account with objectives opening `/welcome` lands on Today |
| Onboarding shown to an account with paused or ended objectives | Prevented | `status=all`, so any objective counts | `onboarding.test.ts`; Chrome with an all-paused account |
| Today slower for everyone | Prevented | The second read runs only inside `day.objectives.length === 0` | Code review; Chrome network log on a normal account: one `/v1/day`, no `/v1/objectives` |
| New objective changes | Prevented | Every prop is optional, and the defaults are today's behaviour | Chrome: New objective's errors, counters, focus, Create → Today with the toast, unchanged |
| Created twice | Prevented | The form's `sending` ref, as now. After 201 the page is step 3, with no form. `/welcome` redirects an account with an objective. **Go to Today** uses `router.replace`, so `/welcome` leaves the history | Chrome: a double click sends one `POST`; a reload of step 3 and Back after Go to Today both land on Today |
| A skip leaking to another account | Prevented | The cookie holds ids; `skippedBy` matches the session's id only | `onboarding.test.ts`; Chrome with two accounts |
| Step 3's first review disagrees with Reviews | Prevented | It reads `upcoming_review_on` from the 201 body | `onboarding.test.ts` takes it from the body, and never computes it |
| The cookie grows without end | Prevented | At most 20 ids, newest kept | `onboarding.test.ts` |
| A skip doesn't follow the account to another browser | Accepted | Decided in G11. A per-account flag needs a contract change | — |
| Leaving part-way loses what was typed | Accepted | The spec says resume at step 1. Back within the page keeps the draft | — |
| The phone's pinned bar on a real device | Accepted, checked after release | Same pattern as New objective's sticky bar | Chrome 390 px here; the release check on a phone |

**The riskiest step: 5.** It changes where every empty account lands, and a mistake is
a loop or a stranded user on the home page. Mitigations:
- one decision function for both pages, with "unknown" meaning "show Today";
- `/welcome` already proven in step 4 before anything sends people there;
- in Chrome, every kind of account: none, skipped, one created, all paused, two accounts in one browser.

**What was not chosen**

- **A server flag for "has onboarded".** G11 decided a cookie. Making a skip follow the account across browsers needs a contract change.
- **Routing in the sign-in screens.** Today decides instead. One rule covers the first sign-in and every later visit, and the sign-in screens stay as they are.
- **A URL per step** (`/welcome/2`). The spec resumes at step 1, and one page keeps the draft on Back without storing it anywhere.
- **A copy of the New objective form.** The spec says reuse. The form takes props instead.
- **Keeping the draft across a reload.** The spec resumes at step 1.
- **A server action or route for the skip cookie.** The browser writes it, as it writes the theme. No new endpoint.
- **Reading the database from the page.** Both checks call the endpoint with the request's cookie, as Today does (D-04).

**Decided, not specified** (for the PR)

- The URL is `/welcome`.
- When the objective starts later, the middle tile reads *Planned a day* "45m". *Planned today* would say "Off day" for a plan that hasn't started.
- The cookie keeps at most 20 accounts, for a year.
- Focus moves to each step's title when the step changes. The progress bars are decorative; "Step n of 3" is the text.

---

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | — | Docs only |
| 2 | `onboarding.test.ts`, at 100 %:<br>• `opens`: no objectives and not skipped opens it; skipped, any objective, or unknown doesn't<br>• the cookie: add, read, a second account, 21 accounts keep the newest 20, a malformed value<br>• `firstObjective`:<br>&nbsp;&nbsp;– starts today vs tomorrow<br>&nbsp;&nbsp;– every day, Mon–Fri, and Mon, Wed, Fri<br>&nbsp;&nbsp;– today planned vs an off day<br>&nbsp;&nbsp;– 45m and 2h 05m<br>&nbsp;&nbsp;– a plan ending next year shows the year<br>&nbsp;&nbsp;– the first review from the body | Unused code |
| 3 | Typecheck, build. Chrome: New objective unchanged. Errors, counters, focus, one `POST` on a double click, and Create → Today with its toast | No caller passes the props yet |
| 4 | Chrome at `/welcome`, 1280 and 390 px:<br>• step 1 with the name<br>• Next, then Back keeps the draft<br>• each design error<br>• Create sends one `POST`<br>• step 3 matches the objective (plan line, Day 1 of 28, first review)<br>• Go to Today<br>• a reload of step 3, and Back, land on Today<br>• tips on desktop only; the phone's hard/easy examples<br>• signed out → Sign in<br>• an account with objectives → Today | Nothing links to `/welcome` |
| 5 | Chrome, with accounts that have: nothing; skipped; created one; all paused; and two accounts in one browser. Each lands where the spec says. Network log: a normal account reads `/v1/day` only. TRIAGE entry removed | — |
| 6 | After the release: the intent's check on the deployed service. A new account confirms its email and goes through the three steps to Today; a second skips; signing in again shows neither onboarding | — |

No itest changes: the API is unchanged. An account with no objectives is needed
locally for steps 4–5. Rohit chooses how: a fresh sign-up, or a test session cookie
for a seeded user, with his approval.
