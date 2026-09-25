# Keel — backlog

**Story W3-06.** Sprints 02–08 from the delivery plan, broken into epics with their
stories **named, not estimated**. Sizing happens at sprint planning, with the
evidence from the sprint before it.

Stories reference the artifacts that already exist: `erd.md` invariants (INV-n),
`keel-api.yaml` operations, `api-gaps.md` gaps (G-n), and the decision register
(D-n). A story that cannot point at one of those is probably invented.

| Epic | Sprint | Week | Stories |
|---|---|---|---|
| [E-02](#e-02) Objectives and the schedule | 02 | 4 | 16 |
| [E-03](#e-03) Logging and Today | 03 | 5 | 14 |
| [E-04](#e-04) Deviations, patterns, parking lot | 04 | 6 | 13 |
| [E-05](#e-05) Review and the numbers | 05 | 7 | 17 |
| [E-06](#e-06) Identity, hardening, observability | 06 | 8 | 16 |
| [E-07](#e-07) Release | 07 | 9 | 9 |
| [E-08](#e-08) Live, and learn from it | 08 | 10 | 8 |

---

## E-02 — Objectives and the schedule {#e-02}

**Sprint 02 · Week 4 · Domain core.** The rules that turn a schedule into dated
commitments. Done when you can create an objective through the API and get back a
correct schedule.

**Decisions this epic must settle:** none — D-10 (where scheduling logic lives) was settled by **ADR-008** (W4-09). See the note below for what it changed.

1. Migration: `objective`, `plan_segment`, `plan_slot` with their constraints
2. Domain: schedule value types, and validation that a fixed schedule has weekdays and a flexible one has a day count
3. Domain: `generateSlots` for a fixed-weekday segment — day rows
4. Domain: `generateSlots` for a flexible segment — week rows with `target_days`
5. Domain: `planSummary` — planned days, off days, target effort, final review date. **Closes G-09** by making the New objective preview call the real generator
6. Domain: `reviewWindows(cadence, segment)` — turns weekly or monthly into dated windows. **Closes G-06**
7. `POST /objectives` — creates objective, segment 0, and that segment's slots
8. `GET /objectives` — list with status filter
9. `GET /objectives/{id}` — segments and status history merged by date (INV-16 note)
10. `POST /objectives/{id}/status-changes` — pause, resume, complete, end
11. Slot suppression while paused, and resumption on resume (INV-10)
12. `GET /objectives/{id}/schedule` — the day-by-day grid. **Closes G-03**
13. Seed the known deviation patterns as reference data
14. Screen: New objective, against the live API
15. Screen: Objectives list and its empty state
16. Tests: slot generation across month boundaries, week starts, a pause and resume, and a flexible week that straddles the end date — plus the two rules that left the database with `plan_slot` (INV-9): no two generated slots cover the same day or week, and a segment yields day slots or week slots, never both

**Changed by ADR-008 (W4-09) — done.** `plan_slot` and `objective.status` are gone
and `status_event` is part of this epic, because slot generation depends on it.
It took three stories in expand-migrate-contract order (ADR-004):

- **W4-10 (expand)** created `status_event` and gave every objective a `created`
  event. It dropped nothing.
- **W4-29 (migrate)** moved every reader: Today and the effort write compute the
  covering slot and read the status from events, `PlanSlot.id` left the contract,
  and the seed stopped writing slots. Closed G-15.
- **W4-30 (contract)** dropped `plan_slot`, `objective.status` and their types.

What that leaves for the rest of E-02: stories 3 and 4 are `generateSlots` taking
`(segment, statusEvents)` and returning values that are never written down — story
4's week rows also close **G-17** (flexible objectives compute no slot yet). Story
11 is no longer "suppression and resumption" as write-time bookkeeping; pausing is
an event the generator reads, already tested, so it shrinks to whatever coverage
the create-objective and status-change endpoints need.

**Not in this epic:** extensions. `canExtend` needs a plan-end review to authorise
it, so it lives in E-05 with the review lifecycle.

---

## E-03 — Logging and Today {#e-03}

**Sprint 03 · Week 5 · The daily loop.** Done when you log your real work in it
every day, with no spreadsheet fallback.

**Decisions this epic must settle:** D-12 (client state and failure handling), and
the open Q7 — whether logging on an off day is silent or confirmed.

1. Migration: `effort_entry` with `local_date`, `logged_at`, `tz`
2. Domain: `classifyEntry` — planned or extra, derived from the covering slot
3. `POST /objectives/{id}/effort-entries`
4. `PATCH /effort-entries/{id}` — everything except the date (INV-2)
5. `DELETE /effort-entries/{id}`
6. `GET /day/{date}` — the one query NFR-03 constrains
7. Screen: Today, wired to the live day read
8. Several entries per objective per day, with running totals
9. The not-scheduled-today state and "log anyway — counts as extra"
10. Screen: Today with no objective yet
11. Loading, empty and error states built as states, not afterthoughts
12. `GET /objectives/{id}/effort?month=` — the Effort tab, read-only
13. End-to-end test: open Today, log an entry, see it appear
14. Verify the Today read is a single round trip, and record the p95

---

## E-04 — Deviations, patterns, parking lot {#e-04}

**Sprint 04 · Week 6 · What makes this Keel rather than a timesheet.** Done after
a full week of real use with no data corrected by hand.

**Decisions this epic must settle:** whether the parking-lot lock is enforced or
advisory — and what that choice says about the product.

1. Migration: `deviation`, `deviation_pattern`, `parked_idea`, `parked_idea_verdict`
2. `POST /deviations` — no objective id, by design (INV-11)
3. `GET /deviations?from=&to=` with cost tallies computed, not stored
4. `GET /deviation-patterns` with occurrence counts computed
5. `POST /deviation-patterns` — naming a pattern you have not named yet
6. Screen: Log a deviation
7. Screen: Parking lot, with the still-parked, taken and dropped sections
8. Screen: Parking lot empty state
9. `POST /parked-ideas` — server sets the lock length
10. `POST /parked-ideas/{id}/verdicts` — append-only, 422 while locked (INV-13)
11. Domain: verdict transitions, including reviving a dropped idea
12. Tests: the lock boundary, verdict history, and what "status then" returns
13. Creating an objective from a parked idea, and the from-parking-lot badge

---

## E-05 — Review and the numbers {#e-05}

**Sprint 05 · Week 7 · The evidence view — the reason the product exists.** Done
when you run a real review of your Python and DSA objective using the app rather
than your memory.

**Decisions this epic must settle:** D-13 (computed on demand or precomputed —
NFR-09 has already narrowed it), and how you will notice a query getting slow.

1. Domain: `adherence(slots, entries)` — the function with six call sites
2. Domain: planned days worked, target met, extra off-day minutes
3. Domain: minutes-per-day series for the period
4. Migration: `review`
5. `POST /objectives/{id}/reviews` — idempotent, 201 then 200
6. `PATCH /reviews/{id}` — draft autosave, 409 once saved
7. `POST /reviews/{id}/save`, and `DELETE` for a draft only
8. The draft state and its two exits — resume and discard (T75, T76)
9. `PUT /reviews/{id}/deviation-verdicts/{deviationId}` — chosen only (INV-12)
10. `GET /reviews/{id}` with every figure recomputed on open (INV-14)
11. Domain: `canExtend` — INV-6 and INV-7 as one function returning a reason
12. `POST /objectives/{id}/extensions` — the Continue dialog
13. Screen: Review, including the previous improvement note quoted back
14. Screen: Review detail, and the reviews list with adherence per window
15. Fix G-04 — saving must not commit a stale draft
16. Seed a realistic dataset so the screens can be seen full
17. Performance check against a year of rows, not fifty

---

## E-06 — Identity, hardening, observability {#e-06}

**Sprint 06 · Week 8 · Willing to leave it running unattended.** Done when you
have *restored* the database from a backup. Not configured it. Done it.

**Decisions this epic must settle:** D-14 (error tracking, logs, metrics),
D-15 (backup, retention, restore).

1. Cognito user pool configured, per ADR-002 — conditional on D-06's outcome
2. OIDC callback exchanging the authorization code for a Keel session cookie
3. Local `user` row keyed by the provider's subject id — the lock-in mitigation
4. Session validation with no network call, seven-day lifetime (NFR-08)
5. Protected routes, and the session-expired screen
6. Screens: Sign in, Create account, Reset password
7. Fix G-13 — the contract's session endpoints, now that the provider owns sign-up and reset
8. Security pass: input validation, injection, secrets, transport, dependency audit, rate limiting
9. Accessibility: keyboard walk of all twelve journeys, focus visible throughout (NFR-13)
10. Accessibility: contrast audit in **both** themes, and every colour-coded status given a word or shape
11. Responsive pass on an actual phone
12. Structured logging with **no entry text** in any log line (NFR-11)
13. Error tracking carrying ids and types only — and a grep of a full session's logs proving it
14. Uptime check against Today, counting only 06:00–24:00 local (NFR-05)
15. Automated backups configured
16. **Perform a restore**, time it, and write down how many steps it took (NFR-01)

---

## E-07 — Release {#e-07}

**Sprint 07 · Week 9 · Hand it over as though to a team you will never meet.**
Done when a stranger could clone it, run it, and understand the system from the
documentation alone.

**Decisions this epic must settle:** D-16 (versioning and changelog convention).

1. Write the release checklist, then run it
2. Version tag and changelog
3. README: what it is, why it exists, screenshots, how to run it
4. Architecture diagram of what you **actually built**, not what Sprint 00 planned
5. Runbook: deploy, roll back, restore, and the three failures most likely to happen
6. Three-minute demo recording
7. Build-log summary — what you would do differently, written while it is fresh
8. Reconcile the ADRs against the code: any that were superseded in practice get a superseding record
9. Reconcile `keel-api.yaml` against the implemented endpoints, and close or re-open every gap

---

## E-08 — Live, and learn from it {#e-08}

**Sprint 08 · Week 10 · Shipping is the middle, not the end.** Done when you have
a v2 backlog justified with data from real use rather than with ideas.

1. Use it daily; triage every bug and annoyance into the backlog as you hit it
2. Fix the top defects — **resist adding features; that urge is the subject of the product**
3. Add the one measurement you keep wishing you had
4. Whole-product retrospective: boxed versus actual per sprint, where the time really went
5. Revisit NFR-06 with evidence — does offline logging earn its cost now?
6. Revisit NFR-12 with evidence — has the midnight or DST boundary actually bitten?
7. Revisit D-08 — did the test strategy catch what it was supposed to?
8. Plan v2 from evidence: the parking lot of the project itself, with verdicts

---

## Carried debt

Everything already known to be owed, and where it lands.

| Item | Lands in |
|---|---|
| G-03 schedule grid endpoint | E-02 |
| G-06 review due-date rule | E-02 |
| G-09 preview duplicating slot generation | E-02 |
| G-15 contract states slots as stored rows | E-02, with W4-10's migration |
| Q7 off-day logging: silent or confirmed | E-03 |
| G-04 save may commit a stale draft | E-05 |
| G-05 which review period is due | E-05 |
| G-07 how `previous_review_id` is set | E-05 |
| G-08 review labels across an extension | E-05 |
| G-13 session endpoints after D-07 | E-06 |
| G-10 sidebar counts | accepted, revisit only if a screen needs it |
| G-11 deviation date range | accepted |
| G-12 "the sentence that repeats" | v2 candidate, E-08 |
| ~~D-10~~ (settled, ADR-008), D-12, D-13, D-14, D-15, D-16 | E-02, E-03, E-05, E-06, E-06, E-07 |

## Sizing signals

Not estimates. The evidence you would use to form your own view at planning.

| Epic | New tables | New endpoints | New screens | Open decisions | Gaps to close |
|---|---:|---:|---:|---:|---:|
| E-02 | 2 | 5 | 2 | 0 | 4 |
| E-03 | 1 | 5 | 4 | 2 | 1 |
| E-04 | 4 | 6 | 3 | 1 | 0 |
| E-05 | 1 | 8 | 3 | 2 | 4 |
| E-06 | 0 | 3 | 4 | 2 | 1 |
| E-07 | 0 | 0 | 0 | 1 | reconcile all |
| E-08 | 0 | 0 | 0 | 3 revisits | — |

**Which epic is underestimated is the review gate for W3-06 — your answer, not
mine.** The table above is the data; the signal worth weighing is that story
count, table count and endpoint count all measure *writing*, and none of them
measures *deciding*. Every epic here that carries open decisions has a cost no
column shows.
