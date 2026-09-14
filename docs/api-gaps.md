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

### G-03 — The objective overview's schedule grid has no endpoint · OPEN
**Found by:** Rohit
The overview screen draws **THE SCHEDULE** — a day-by-day grid across the whole
run, with five states per day: target met, worked but short, planned and nothing
logged, off day, off day worked anyway.

`GET /objectives/{id}` returns segments, status history and whole-run figures.
None of that is the grid. Computing it client-side would need every slot and
every entry for the whole run, which for a 112-day objective is the fan-out
NFR-03 exists to prevent.

**The decision:** add a `schedule_grid` array to `GET /objectives/{id}`, or give it
its own endpoint (`GET /objectives/{id}/schedule?from=&to=`) so the overview and a
future calendar view share one read. The second is probably right — the grid is
the largest thing on that response and not every caller wants it.
**Blocks:** the objective overview screen.

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

### G-05 — Nothing tells the client which review period is due · OPEN
**Found by:** Rohit
`POST /objectives/{id}/reviews` requires `period_start` and `period_end`, but
nothing in the contract tells the client what they are. The client would have to
derive the window from the cadence and the start date — reimplementing a rule
that belongs on the server, and getting it wrong across an extension boundary.

The screen says "Start review — due today", so the server already knows. The
contract just never says so.

**The decision:** `GET /objectives/{id}` returns a `next_review` object with
`period_start`, `period_end`, `kind` and `due_on`; the client posts those back, or
posts nothing at all and lets the server pick. Prefer the latter — a client that
cannot name a wrong period cannot start a review for one.
**Blocks:** the review screen and the "due today" flag on the objectives list.

### G-06 — No rule computes a review due date from a cadence · OPEN
`next_review_on` appears in `ObjectiveSummary`, and the objectives list shows
"NEXT REVIEW 21 Sep". Nowhere is it written how a weekly cadence turns into due
dates: from the start date or from calendar weeks, what happens to the partial
week at the end, and whether a paused stretch shifts everything.
**Related to G-05** — same missing rule, two symptoms.

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
| Closed | 2 |
| Open | 8 |
| Accepted | 3 |

**Two of the seven block Sprint 01's first screens: G-03 and G-05.**
G-04 does not block, but it is the one that would ship as a silent data-loss bug.
