# Keel — Non-functional requirements

Sprint 00 · Story W2-04 · 13 statements

A non-functional requirement says how well the system must work, under what conditions, and what happens when things go wrong. The test for a real one: **can you fail it?**

## Scope changes

- **NFR-06 — out of scope for v1.** Offline logging, decided at D-04. No sync queue, no client-generated ids, no conflict rule.
- **NFR-12 — split, not dropped.** Deferred to v2: DST boundaries, a user changing timezone, and the offline-queue clause (which belongs to NFR-06). Kept in v1: the `local_date` column, the client sending the day it means, and the four-timezone server-independence test running in the pipeline since W3-19.

---

## NFR-01 — Integrity of the record

*Correctness*

**An entry Keel has acknowledged as saved is never lost, silently altered, or moved to a different day.**

- **Measure and number** — 0 discrepancies between entries acknowledged and entries present after a restore, from a backup no more than 24 hours old. **Acknowledged** means the server has persisted it — an entry still sitting in the offline queue is not acknowledged and must say so on screen.
- **How it is checked** — Restore drill once per release: seed 200 entries, back up, wipe, restore, diff row by row.
- **What it costs** — A save is confirmed **after** the write has landed, not before. That makes the acknowledgement slower than an optimistic one — NFR-04 is how you keep it from **feeling** slower.
- **Why this one exists** — Keel's only claim is that the record, not your memory, decides. A logbook that quietly drops a day is worse than no logbook, because you would still trust it.

## NFR-02 — Time to log a day

*Speed*

**Logging an ordinary day takes under a minute, start to finish.**

- **Measure and number** — Median wall-clock from opening Today to a saved entry <= 60s. 90th percentile <= 2 min.
- **How it is checked** — Timestamp on screen-open and on save-acknowledged; read the distribution at the weekly review.
- **What it costs** — This caps how many fields a day can carry. Every future field proposed for Today has to be argued against this number, and some will lose.
- **Why this one exists** — Your own brief set it: a minute. Written down as a number it becomes a constraint on the design instead of an intention.

## NFR-03 — Today opens fast

*Speed*

**Today is usable within a second on a warm load, and within two and a half on a cold one.**

- **Measure and number** — p95 time-to-interactive <= 1.0s warm, <= 2.5s cold over a 4G-class connection. The data fetch behind it p95 <= 300ms.
- **How it is checked** — Browser performance marks reported per load; one scripted cold load per release on a throttled profile.
- **What it costs** — Today cannot fan out into one query per objective. It needs a single query that returns the day. **This shapes Thursday's ERD.**
- **Why this one exists** — Today is the screen you open every day. It is the only one where load time competes with the urge not to bother.

## NFR-04 — Saving feels immediate

*Speed*

**A logged entry appears in the day's list within 100ms of the tap — before the server has answered.**

- **Measure and number** — p95 tap->render <= 100ms. The server's answer reconciles within 5s, or the entry carries a visible **not saved yet** mark.
- **How it is checked** — Instrument both timestamps; assert on the gap in an automated interaction test.
- **What it costs** — Optimistic rendering, a reconciliation path, and an unmistakable unsaved state. Optimistic on screen — never optimistic in the acknowledgement (NFR-01).
- **Why this one exists** — NFR-03 is how long you wait. This is whether the wait is visible. They are different qualities and they need different numbers.

## NFR-05 — Available at logging time

*Availability*

**The number of days in a year on which you wanted to log and could not is zero.**

- **Measure and number** — <= 2 unavailable days per year, target 0. 99% monthly availability, measured on the Today screen only, counting only failures between 06:00 and midnight local.
- **How it is checked** — A scheduled request to Today every five minutes; a monthly count of failed windows.
- **What it costs** — Nothing beyond ordinary hosting. Deliberately **not** 99.9%.
- **Why this one exists** — 99.9% allows 43 minutes of downtime a month; 99% allows 7.2 hours. For a logbook whose writes can be deferred, 99% plus the queue in NFR-06 buys more real reliability than the extra nine, at an order of magnitude less cost. Availability targets are bought, not wished for.

## NFR-06 — A degraded day is still a logged day

*Dependency down*

**With no network, Keel still opens, shows the last data it held, and accepts new entries. They are sent when the connection returns.**

- **Measure and number** — Offline, Today renders in <= 1s from cache and accepts entries. A queued entry carries **the time the user meant, not the time it synced**. The queue survives a browser restart and holds for at least 72 hours. Zero entries dropped.
- **How it is checked** — Airplane-mode drill per release: log three entries offline, restart the browser, reconnect, verify all three land on the correct days.
- **What it costs** — Local storage, a write queue, a conflict rule, and a visible sync state. This is the most expensive requirement on the page — and the one most likely to be cut. Cut it deliberately, not by forgetting.
- **Why this one exists** — The days you most need the record are the days something is going wrong. Those correlate with being somewhere without signal.

## NFR-07 — Behaviour when the database is unreachable

*Dependency down*

**A database outage degrades Keel to read-only behind a plain banner. It never shows an empty log or a wrong number.**

- **Measure and number** — 100% of read failures render **couldn't reach your log** — never a zero, never a blank, never a stale figure without its timestamp. Writes fall into the NFR-06 queue.
- **How it is checked** — A fault-injection switch that fails every database call; walk the six main screens and confirm each one.
- **What it costs** — An error state on every screen, and every screen has to tell **no data** apart from **no answer**.
- **Why this one exists** — Your flow map already draws this line: S15–S18 are the empty states, S20–S22 are the failure states. They look different and they mean different things. A zero on an effort chart is a claim about your week.

## NFR-08 — Behaviour when sign-in is unreachable

*Dependency down*

**A session that is already valid keeps working for its remaining life. Nobody is signed out because the sign-in service is down.**

- **Measure and number** — An open session stays valid for >= 7 days without reaching the auth service. A failed sign-in returns a message naming the cause within 5s. Zero forced sign-outs caused by auth being unreachable.
- **How it is checked** — Block the auth host at the network level; confirm an open session continues and a new sign-in fails clearly rather than hanging.
- **What it costs** — Session validation cannot make a round trip on every action, which means a signed token with a real expiry rather than a server lookup.
- **Why this one exists** — Being thrown to a sign-in screen you cannot get past is the failure most likely to end the habit. S19 in the flow map is the honest version of it.

## NFR-09 — The data is small, and stays small

*Data volume*

**One user's entire history is under 2,000 rows and under 1 MB per year.**

- **Measure and number** — Row count and byte count per user per year, checked once a quarter against a ceiling of 2,000 rows and 1 MB.
- **How it is checked** — A query that counts rows and measures bytes per user; compare against the derivation above.
- **What it costs** — None. This requirement exists to stop you spending.
- **Why this one exists** — At ten years one user is roughly 17,000 rows and 4 MB — smaller than a single photograph. **Keel has no scale problem.** Any design that reaches for caching layers, denormalised rollups, archive tables or a second datastore is solving a problem that does not exist here. Every screen can afford to be a live query.

| Source | Rows | Basis |
|---|---:|---|
| Plan slots | 780 | 3 objectives × 5 planned days × 52 weeks |
| Effort entries | 585 | 75% of slots actually logged — your observed rate |
| Deviations | 93 | 0.6 per objective-week |
| Reviews | 156 | weekly, per objective |
| Objectives | 6 | started in a year |
| Parked ideas | 60 |  |
| Total | 1,680 rows · 0.4 MB | one user, one year |

## NFR-10 — Built for one, not fragile at a hundred

*Data volume*

**v1 serves one user. The design must not need rewriting at 100 concurrent users, and is explicitly not built for 10,000.**

- **Measure and number** — No shared mutable state held in memory between requests. Every query filtered by user. 100 concurrent Today loads stay inside NFR-03.
- **How it is checked** — A load test at 100 concurrent Today loads, run once before launch.
- **What it costs** — The discipline of scoping every query by user from the first line. Nearly free now, very expensive to retrofit.
- **Why this one exists** — Writing the ceiling down is what lets you say no to work later without guessing. It also stops the opposite failure: building something that cannot survive showing it to five friends.

## NFR-11 — Entry content is private by construction

*Privacy*

**Deviation reasons, review answers and objective notes are diary-grade text. They never leave the system in readable form.**

- **Measure and number** — 0 occurrences of entry text in analytics events, error reports, or application logs — error reports carry identifiers and error types only. TLS 1.2+ in transit, encrypted at rest. 0 cross-user reads across an authorisation suite covering 100% of read endpoints.
- **How it is checked** — Walk a full session, then grep the entire log output for known entry strings; expect no hits. The authorisation suite runs on every commit.
- **What it costs** — Debugging gets harder: you cannot paste a user's log into an issue. You need a reproduction path built on identifiers.
- **Why this one exists** — "I stopped because I felt like a fraud" is exactly the sentence Keel exists to capture, and exactly the sentence you never want sitting in a log aggregator. This is the requirement that would embarrass you.

## NFR-12 — A day is your local day, always

> **Split for v1 — schema kept, test matrix deferred**

*Correctness*

**An entry belongs to the calendar day it was logged in the user's local time, and it never moves afterwards.**

- **Measure and number** — **v1, in force:** the date an entry is stored under depends only on what the client sent — not on the server's timezone, the database session timezone, or when the request arrived. The suite passes identically under TZ=UTC, Asia/Kolkata (a half-hour offset), Pacific/Kiritimati (UTC+14) and America/Los_Angeles (UTC−8): zero differences across the four. **v2, deferred:** an entry logged at 23:55 keeps its date across a daylight-saving shift and across a user changing timezone — zero entries changing day across four zones crossed with a DST boundary. The offline-queue clause moves with NFR-06.
- **How it is checked** — **v1:** the unit suite runs four times in the pipeline, once per timezone above; a difference between runs is the failure. Chosen so a break is caught in either direction — a UTC+14 run catches a day gained, a UTC−8 run a day lost, and the half-hour offset catches hour-only arithmetic. **v2:** the DST matrix, plus one manual check at each DST change.
- **What it costs** — You must store the local date **as a date**, alongside the instant and the zone — not a UTC timestamp you convert on the way out. **This is a schema decision, and it is the half of this requirement that v1 keeps.**
- **Why this one exists** — Streaks, adherence, and every review figure are counted in days. If a day boundary can move, every number Keel shows you can move with it. **Deferred in part for v1** — see the note below.

## NFR-13 — Operable without a mouse, readable without colour

*Accessibility*

**Every action in Keel can be completed with the keyboard alone, and no meaning is carried by colour by itself.**

- **Measure and number** — 100% of the 12 journeys in the flow map completable by keyboard, with a visible focus ring at every step. Body text contrast >= 4.5:1, and UI borders, icons and large text >= 3:1, against their own surface in **both** themes. Every status that uses colour also carries a word or a shape. Touch targets >= 44×44 px. 0 form fields without a programmatic label.
- **How it is checked** — A keyboard-only walk of all 12 journeys once per release, no mouse touched. An automated contrast and labelling scan on every commit. One screen-reader pass over Today and Log a deviation before launch.
- **What it costs** — It rules out a few patterns before you reach for them: drag-only reordering, controls that only appear on hover, and status shown by colour alone. Cheap to hold from the first screen, expensive to retrofit across twenty.
- **Why this one exists** — Your design already leans on colour for state — green for on plan, blue for chosen, red for drifted. Colour alone fails for the 8% of men with a colour vision deficiency, and it fails for everyone in bright sunlight. The wider point: this is the requirement most often postponed and most expensive to add late, because it is not a feature you bolt on, it is a property every screen either has or does not.

---

## Four numbers only you can set

- **NFR-02 — 60 seconds to log a day.** Your brief said a minute. Is a minute the promise, or is it 30 seconds? The answer decides how many fields Today is allowed to have.
- **NFR-05 — Two missing days a year.** How many days can Keel be unreachable before you stop trusting it as a record? Your answer sets the hosting budget, not the other way round.
- **NFR-06 — 72 hours of offline queue.** What is the longest stretch you need to survive — a weekend, a flight, a week without signal? This one is expensive, so the number matters.
- **NFR-08 — A 7-day session.** How long before Keel makes you sign in again? Shorter is safer and more annoying. It is your diary and your laptop.

## Deliberately not here

- **Two devices, both offline, same day** — A real gap in NFR-06. If your phone and your laptop both log Tuesday while offline, which one wins? Take this to the ERD as an open question — it is a data-model answer, not a UI one.
- **Internationalisation** — One user, one language. Revisit if that changes.
- **Support response times** — There is no one to respond to. An SLA with no users is theatre.
- **Disaster recovery beyond the restore drill** — NFR-01's drill proves the backup works. Regional failover is a cost with no matching risk at this size.