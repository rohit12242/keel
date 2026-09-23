# Keel — contract gaps

**Story W2-11** · walking `keel-api.yaml` against the fifteen screens.
Gaps listed, not fixed. A gap here is a place a screen shows something the
contract cannot serve, or a rule the contract assumes but never states.

Status: `OPEN` needs a decision · `CLOSED` fixed in the contract · `ACCEPTED` deliberate for v1.

---

## Closed while reviewing

### G-01 — No way to create an account · CLOSED
**Found by:** Rohit
Screen S02 Create account had no endpoint. The contract could sign a user in but
never make one.
**Fixed:** `POST /users` — creates the account *and* signs in, so the client lands
on Today rather than bouncing to sign-in. Note it returns **409 on a taken email**,
unlike sign-in and password reset, which never reveal whether an account exists.
There is no way to offer account creation without disclosing that, so the
inconsistency is deliberate and worth knowing.

### G-02 — No password reset · CLOSED
**Found by:** the same read
Same class of hole. S23 Reset password exists, and Q2 settled that reset ships in
v1, but neither endpoint was in the contract.
**Fixed:** `POST /password-resets` (always 202, whatever the address) and
`POST /password-resets/{token}` (single-use; invalidates every session).

---

## Open — decide before Sprint 01

### G-03 — The objective overview's schedule grid has no endpoint · CLOSED
**Found by:** Rohit
The overview screen draws **THE SCHEDULE** — a day-by-day grid across the whole
run, with five states per day: target met, worked but short, planned and nothing
logged, off day, off day worked anyway.

`GET /objectives/{id}` returns segments, status history and whole-run figures.
None of that is the grid. Computing it client-side would need every slot and
every entry for the whole run, which for a 112-day objective is the fan-out
NFR-03 exists to prevent.

**Fixed (W3-20):** its own endpoint — `GET /objectives/{objectiveId}/schedule?from=&to=`
— returning a `ScheduleGrid` of one `ScheduleDay` per day, each with one of the
five states (`target_met`, `worked_short`, `planned_no_log`, `off_day`,
`off_day_worked`). A separate read, not a field on `GET /objectives/{objectiveId}`:
the grid is the largest thing that response would carry and most callers do not
want it, and a future calendar view reads the same shape. Each day names its plan
segment, so an extension with a different schedule renders correctly. Computed
server-side, so no per-day fan-out (NFR-03).

**Status (W3-21):** the contract change merged in PR #17, bundled into the W3-21
commit. The endpoint has no code yet — W4-20 implements it.

### G-04 — Saving a review may commit a stale draft · OPEN
**Found by:** Rohit
`POST /reviews/{id}/save` takes no body. It assumes the last `PATCH` autosave
already landed. If the user types a final sentence and clicks Save inside the
autosave debounce, that sentence is not in the draft and the saved record is
missing it — silently.

**The decision:** either `save` accepts the full review body and writes it
atomically, or the client must flush a `PATCH` and wait for it before calling
save. The first is safer and removes a race the client would otherwise have to
get right every time.
**Note:** this is the same class of bug as NFR-01's "never silently altered" —
here it is *never silently dropped*.
**Blocks:** the review screen.

### G-05 — Nothing tells the client which review period is due · CLOSED
**Found by:** Rohit
`POST /objectives/{id}/reviews` requires `period_start` and `period_end`, but
nothing in the contract tells the client what they are. The client would have to
derive the window from the cadence and the start date — reimplementing a rule
that belongs on the server, and getting it wrong across an extension boundary.

The screen says "Start review — due today", so the server already knows. The
contract just never says so.

**Fixed (W3-20):** the body of `POST /objectives/{objectiveId}/reviews` is now
**optional**. With no body, the server starts or resumes the period that is
currently due — a client that cannot name a period cannot name a wrong one across
an extension boundary. A body is still accepted, but only to resume a specific
earlier draft, and the server rejects a window that is not a real review period
rather than inventing a review for it. A new `422` covers "nothing is due".

The "due today" flag keeps using `next_review_on`, already on `ObjectiveSummary`
(and so on `GET /objectives/{id}` too). That field was never the gap — it answers
*whether* a review is due. The gap was the forced `period_start`/`period_end` on
the *write*, which a single date cannot supply. The write no longer needs them.
**Note:** the underlying cadence-to-window rule this leans on is still **G-06**,
which stays open — G-05 removes the client's need to reimplement it, G-06 is where
the server's own version gets specified.

**Status (W3-21):** the contract change merged in PR #17. `startReview`'s optional
body and its `422` have no code yet — E-05 implements them.

### G-06 — No rule computes a review due date from a cadence · OPEN
`next_review_on` appears in `ObjectiveSummary`, and the objectives list shows
"NEXT REVIEW 21 Sep". Nowhere is it written how a weekly cadence turns into due
dates: from the start date or from calendar weeks, what happens to the partial
week at the end, and whether a paused stretch shifts everything.
**Related to G-05** — same missing rule, two symptoms.

**Spec written (W3-20):** `docs/domain/review-windows.md` defines the rule. This gap
closes when W4-15 implements it.

### G-07 — Nothing states how `previous_review_id` is set · OPEN
The review screen quotes "last week you said this needed improvement", which
depends on the link being correct at creation. The contract exposes the field and
never says who fills it or what happens when a period is skipped entirely.

### G-08 — Review labels are undefined across an extension · OPEN
The reviews list shows "Week 1", "Week 2", "Week 3", then "End of plan", then more
weeks after an extension. Does numbering restart at each segment or run
continuously? Both are defensible; neither is written down.

### G-09 — The New objective preview panel has no source · OPEN
Creating an objective shows a live panel — planned days, off days, target effort,
final review date — computed from the form *before anything is created*. There is
no endpoint for it, so today it is client-side arithmetic that duplicates the
server's slot-generation rule. Two implementations of one rule will drift.
**The decision:** a `POST /objectives/preview` that runs the real generator and
returns the same shape, or accept the duplication and cover it with a test that
compares the two.


### G-13 — D-07 supersedes three session endpoints · OPEN
**Found by:** ADR-002
Authentication is delegated to a managed identity provider; Keel owns only the
session. `POST /users` and both `/password-resets` endpoints are the provider's
job now, and `POST /session` becomes a callback that exchanges the provider's
assertion for a Keel session cookie.

Note this partly supersedes **G-01** and **G-02**, fixed two days ago. That is the
normal cost of writing a contract before every decision behind it is closed — the
contract was still right to write first, because it is what made this decision's
consequences visible immediately rather than in Sprint 03.
**Blocks:** nothing this week. The walking skeleton can run on a stub session.
**Provider:** Cognito, conditional on D-06 landing on AWS — so `POST /session`
becomes an OIDC callback. If D-06 falls back off AWS, this gap's fix changes shape
and should not be written until that is settled.

### G-14 — `/health` never returns the 503 the contract declares · OPEN
**Found by:** the W3-21 reviewer (PR #17)
The contract says `/health` answers 200 when the database responds and 503 when only
the app is up. `src/app/health/route.ts` always calls `jsonResponse(200, …)`, so a
database outage reads as HTTP 200 with `database: "unreachable"` in the body.
Pre-existing from W3-16, where the route returned 200 on purpose so the load balancer
keeps routing to a live task before a database exists.

**The decision:** either the route returns 503 when the database is unreachable (the
contract is right), or the contract drops the 503 and callers assert on the
`database` field (the code is right). The load-balancer health check decides it: if
the ALB probes `/health`, a 503 during a database outage pulls a healthy app task out
of rotation — which an app-alive check should not do.
**Blocks:** nothing now. It matters for NFR-07 and the E-06 uptime check.

### G-15 — The contract states slots as stored rows · OPEN
**Found by:** W4-09 (ADR-008)
ADR-008 drops `plan_slot`: a slot is a value computed by
`generateSlots(segment, statusEvents)`, never a row. The contract says otherwise in
two ways.

- `PlanSlot` **requires `id: uuid`** (`keel-api.yaml:1120-1129`), returned inside
  `DayObjective.slot`. A derived slot has no row id to give.
- The prose describes generation as persistence: "generates that segment's slots"
  (`:360`), "Pausing stops plan-slot generation; resuming starts it again" (`:475`),
  "New segment created and its slots generated" (`:541`).

**The decision:** drop `PlanSlot.id` (a slot is identified by its segment and
`period_start`, which was already its uniqueness rule), or keep an id and let the
server mint a stable synthetic one. Dropping is the honest option — an id the
client cannot use to address anything is an invitation to store it. The prose
changes either way, from generation-as-writing to generation-as-computing.

**Not fixed here on purpose.** W4-09 is the decision and the ERD; it writes no
contract change and no code. **Blocks:** nothing yet — no code serves `slot`
today. It must land with W4-10's migration, or the contract will describe a table
that no longer exists.

---

## Accepted for v1

### G-10 — The sidebar's shared counts are on no endpoint · ACCEPTED
Every screen's sidebar shows "DAY 14 OF 30" and "3 OBJECTIVES ACTIVE". No single
read provides them. For v1 the client can derive both from whatever it already
fetched. Revisit if a screen appears that fetches neither objectives nor the day.

### G-11 — `GET /deviations` requires a date range · ACCEPTED
The deviation screen shows "recorded so far" with no visible window. Requiring
`from` and `to` means the client picks a default. Fine at 93 deviations a year;
it stops being fine only at a volume NFR-09 says Keel will not reach.

### G-12 — "The sentence that repeats" has no definition · ACCEPTED
The reviews tab surfaces an improvement note written at several reviews and never
acted on. Nothing defines what makes two sentences "the same". Deliberately out of
v1 — it is a feature, not a gap in plumbing, and it needs its own thinking.

---

## Not gaps, checked

- **Error states** S19/S20/S21/S22 — covered by 401, 404, 503 and normal loading.
- **Effort tab** — `GET /objectives/{id}/effort?month=` serves it, including planned
  days with no entry, which is what the "−60" rows need.
- **Adherence by review window** — `listReviews` returns `adherence_pct` per review,
  which is the chart.
- **Parking lot counters** — "3 parked · 1 taken · 2 dropped" is a client-side tally
  of the list.
- **Deviation cost totals** — returned by `GET /deviations`, computed not stored.

---

## Count

| Status | Count |
|---|---|
| Closed | 4 |
| Open | 8 |
| Accepted | 3 |

**G-03 and G-05, which blocked Sprint 01's first screens, are both closed (W3-20).**
Of what remains, G-04 does not block, but it is the one that would ship as a silent
data-loss bug — the next one worth taking.
