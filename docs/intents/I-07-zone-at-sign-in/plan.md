# Plan — I-07 · The server knows the user's zone

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-10-23 · **Written:** 2026-10-23

## What the code has today, and what changes

| Today | Where | Becomes |
|---|---|---|
| The browser sends only `{ id_token }` | `session/browser.ts` `signInToKeel` | `{ id_token, tz }`, the browser's zone. Sign-up reaches the same call through `confirmAccount` |
| The body check is inline: an `id_token` or 400 | `session/service.ts` `createSession` | A pure check in `session/domain/session.ts` naming each bad field, `id_token` and `tz` |
| A new user is written with `'UTC'`; an existing user's zone never changes | `session/repo.ts` `createUser` | Created with the zone sent; an existing user's zone is replaced at each sign-in |
| Today with no `?date=` renders "Loading your day…" and `BrowserDay` hops to `/?date=<browser day>` | `(app)/(today)/page.tsx`, `BrowserDay.tsx` | Today reads `user.tz` and renders today in it, on the first response. No `?date=` at all; `BrowserDay.tsx` is deleted |

`isValidTz` (`effort/domain/validateWrite.ts`) is the zone check every write already
uses; the sign-in uses it too. `localDayOf` (`shared/time/localDay.ts`) stays the
one place a day is read from an instant. `useBrowserDay` (`src/app/browserDay.ts`)
stays: the New objective page still sends the browser's day and zone.

Every server check against today already reads `u.tz` in its query (deviations,
effort, objectives, parking, reviews). None of them changes.

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/intents/I-07-zone-at-sign-in/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 2 | `src/modules/session/browser.ts`, `browser.test.ts` | `signInToKeel` sends `tz: Intl.DateTimeFormat().resolvedOptions().timeZone`. The server ignores it until step 4 |
| 3 | `src/modules/session/domain/session.ts`, `session.test.ts` | `exchangeBody(body)`: `{ idToken, tz }`, or the bad fields (`id_token` required, `tz` required and known to `isValidTz`) |
| 4 | `src/modules/session/service.ts`, `repo.ts`, `src/app/v1/session/route.ts`, `session.itest.ts` | `createSession` uses `exchangeBody`, after the origin check and before the keys are fetched. `createUser(identity, tz)` writes the zone; a sign-in as an existing user runs `setZone(userId, tz)`. The 400 names the fields `exchangeBody` found |
| 5 | `src/modules/session/repo.ts`, `service.ts`; `src/app/(app)/(today)/page.tsx`; `BrowserDay.tsx` *(deleted)* | `zoneOf(userId)`: one query for `user.tz`. Today reads it, takes `localDayOf(new Date(), zone)`, and fetches that day. `searchParams` keeps only `reset` |
| 6 | `docs/intents/TRIAGE.md` | "A new user's zone is UTC" is closed and removed. Anything new found goes in |

## Order of work

1. **Accept the plan.** `plan.md` committed alone.
2. **The browser sends its zone.** First, so a deployed server that requires it never meets a sign-in screen that doesn't send it.
3. **The pure body check.** Nothing uses it yet.
4. **The sign-in stores the zone.** New users get it; existing users have it replaced.
5. **Today opens on the stored zone's day.** The hop and `?date=` go.
6. **Proof** on localhost, then TRIAGE. The deployed check follows the merge, released together with I-06.

No migration (`user.tz` exists, NOT NULL), no infra, no dependency. The contract change
is already in `docs/keel-api.yaml` from the spec commit.

---

## Risks

**What could break**

- **Signing in.** It is the only way in. If the exchange refuses a good request, no
  one can sign in, and a new account is confirmed at Cognito but has no Keel user.
- **A zone the server's ICU does not know.** The browser's zone could be newer than
  Node's data. The sign-in is then refused with 400, which the sign-in screens show
  as "Couldn't reach the sign-in service". Node 26 ships current ICU, and browsers
  return IANA names, so this is unlikely, but the words would not say what went wrong.
- **The double-click race in `createUser`.** Two exchanges for one new subject: the
  second insert writes nothing and reads the row back. Both carry the same zone, so
  the row is right either way.
- **Today with no user row.** `zoneOf` finds nothing only if the row is gone, which
  never happens (NFR-01). Today then goes to Sign in, as for an ended session.
- **The day the server shows.** Today now works its day out on the server, from the
  clock and the stored zone. CLAUDE.md lists "deriving the day on the server" as a
  mistake, which is about *recorded* dates; this only picks which day to *show*, and
  every recorded date still comes from the client (NFR-12). `docs/erd.md` already says
  `user.tz` is the zone the server reads "today" in.
- **The browser and the stored zone disagreeing.** While travelling, Today shows the
  stored zone's day and the New objective page the browser's. Out of scope (spec).
- **Sessions from before this change.** Their users stay in UTC until they sign in
  again. Keel has no users yet, so nothing waits.

**The riskiest step: 4.** It changes the only door in. Mitigations: step 2 ships
first, so every sign-in screen already sends `tz`; the itests cover every response
`POST /v1/session` declares, with `tz` in every body; and a real sign-in on
localhost, then on the deployed service, before anything else is checked.

**What was not chosen**

- **The zone in the session cookie.** Rohit chose the database read (2026-10-23): no
  change to ADR-002 or the cookie, one source of the zone, one query on Today.
- **Updating the zone from later writes.** Travel is out of scope; only a sign-in
  changes the zone.
- **Keeping the hop as a fallback.** Every signed-in user has a row with a zone, so
  there is nothing for it to fall back from.
- **`GET /v1/session` returning `tz`.** Nothing needs it; the spec keeps it as is.
- **A clearer message for an unknown zone.** The spec shows it as any other failed
  exchange. If it happens, it is a TRIAGE entry.

---

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | — | Docs only |
| 2 | `browser.test.ts`: the exchange body is `{ id_token, tz }`, with `tz` the runtime's zone | The server ignores a field it doesn't read |
| 3 | `session.test.ts`, 100 % (ADR-007): both fields good; `id_token` missing, empty or not a string; `tz` missing, empty or unknown (`Mars/Olympus`); both bad at once names both; a body that isn't an object | Unused code |
| 4 | itests (CI): a first sign-in creates the user with the zone sent; a second sign-in from another zone replaces it; an unknown zone is 400 naming `tz`, writes no user and fetches no keys; a body with no `tz` is 400; every existing case sends `tz` and still passes | The browser already sends `tz` (step 2) |
| 5 | Chrome, local: sign in → `user.tz` is the browser's zone (psql); `/` renders today in it on the first response, with no `?date=` request and no client navigation (network log); `/?date=2026-01-01` shows today; `/?reset=done` shows its notice. With `user.tz` set to `Pacific/Kiritimati` by hand, `/` shows that zone's date, which proves Today reads the stored zone and not the browser's | The full feature |
| 6 | After the release: the intent's check on the deployed service | — |

Integration tests run in CI only. Locally, the proof needs one real sign-in, which
Rohit types.
