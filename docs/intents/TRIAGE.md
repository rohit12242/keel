# Triage queue — what is known, not yet decided

Two things land here:

- a review finding that is **real but outside the intent being built**, which never
  becomes an extra step in the plan it interrupted;
- a **known limit the contract cannot express** — a hazard invisible in the schema,
  or a rule the contract assumes and never states.

Each entry is either promoted to its own intent, or dropped with a reason. Dropped
entries stay, with the reason — a queue that only grows is a backlog, and a queue
that forgets is a promise nobody kept.

**What does not belong here:** anything the contract, the ERD or an ADR can hold, and
the small decisions taken while a spec or a plan is written. The test is whether a
future intent would be *wrong* without the entry.

## Open

### The review-windows property test runs close to its timeout · found in I-15

"always tiles the segment, ends on calendar boundaries, and joins every short period"
(`reviewWindows.test.ts`) takes about 1 s alone, but 2.6–3.2 s inside `npm run test:tz`,
against vitest's 5 s default. With the machine busy (`next dev` compiling), it timed out
once under `Pacific/Kiritimati`, and passed on the rerun. Either make it do less work
(fewer start dates, or one cadence per case) or give it its own timeout, with the reason
written next to it.

### A status change can be dated in the future · found in I-15

`POST /objectives/{id}/status-changes` stores `occurred_on` as sent and checks only
that it isn't before the latest change. A note dated after today is refused (`422`),
but a pause dated next week is accepted, and its paused stretch then starts later
than the request says it did. The UI always sends today in the user's zone, so only
a direct API call can do it. Refusing a future `occurred_on` is a contract change.

### The API can complete an objective without its final review · found in I-15

The status-change endpoint accepts `complete` from `active` or `paused`
(`statusChange.ts`). That breaks the rule that only the plan-end review completes an
objective (ERD invariant 7). The UI never sends it. Removing `complete` from the
request enum, so completing goes only through saving the final review, is a contract
change.

### An owed extension reads as "final review due" on Today and the list · found in I-14

A final review saved with Extend whose extension wasn't made (G49) leaves the
objective active with its plan ended. Today's card says "Plan ended {date} · final
review due" and the objectives list "Plan ended · final review due", though the
review is saved; what is owed is the extension. The Overview and the saved review
say so and offer **Make the extension**. Today and the list would need the owed
extension in `DayObjective` and `ObjectiveSummary`, or a rule that derives it from
what they already carry.

### `objective.review_cadence` is written and no longer read · found in I-14

Since each segment carries its own `review_cadence` (ADR-008, I-14 amendment), the
objective's column is written at create and never read; `Objective.review_cadence`
reads as the latest segment's. Either drop the column in a migration, or keep it as
the creation fact and say so in the ERD. Not urgent: nothing can make the two
disagree, since nothing writes the objective's after create.

### A saved review's head shows the plan as it is now · found in I-14

A saved review's sub-line ends with the objective's schedule ("Fixed · Mon–Sat · 2h
a day"), which is the latest segment's. After an extension changes the schedule,
every earlier saved review, final review included, shows the extension's schedule
rather than the one it reviewed. The head would read the schedule of the segment
holding the review's `period_end`; `Objective.segments` already carries it.

### A shared deviation can be judged by an unsaved draft of another objective · found in I-13

A Chosen deviation can name two objectives. A draft review of one can judge it. Since
G47 that verdict doesn't show outside the draft, so the other objective's review
offers It held / It didn't hold, and a click gets the 409 "An earlier review already
judged this deviation". On screen that review can't be saved until the first draft
is saved or discarded. The API can save it, because `saveDecision` counts the stored
verdict. If the first draft is then discarded, its verdict goes with it, and the
saved review has a Chosen deviation nobody judged and nobody now can. Only the API
can make a deviation name two objectives today (G46). The fix is a rule change:
either a verdict belongs to the deviation per objective, or a draft's verdict
doesn't block another review.

### A deviation has no recorded date · found in I-12

The design's deviation detail opens with "Recorded 2 Sep", but `Deviation` carries only
`local_date`, the day it happened. A deviation can be recorded on a later day of the
same week, so the two differ. I-12 shows the kind pill alone in the head and keeps the
day in **When**. Showing "Recorded" needs the recorded day on `Deviation` (the column,
`recorded_at`, exists), and a contract change with it.

### Back to Today shows the page as it was · found in I-12

Recording a deviation from Today goes to the Deviations page. Back then shows Today as
the router cached it, so **Last deviation** is the one before. Opening Today from the
navigation reads it again and shows the new one. Every page behaves this way after a
write elsewhere, e.g. Log time and Back. Fixing it means deciding how the app refreshes
a page brought back by Back, once, rather than page by page.

### `D` on the Parking lot · found in I-12

`01-shell.md` gives `D` to the Parking lot as well. I-12 builds Log a deviation on
Today and Deviations only; the Parking lot screen isn't built. When it is, it puts
`LogDeviationProvider` around its page, as Deviations does.

### Today's summary still says "Extra, off days" · found in I-11

I-11 renamed the Objectives figure to **Unplanned day effort**, time only (Rohit):
the minutes on days the plan doesn't cover, which include paused days and days after
the end, not only off days. Today's summary keeps "Extra, off days" for the same
measure over the week (`totals.extra_off_day_minutes`). The two screens should use
one name; changing Today's is its own small intent, with `03-today.md`.

### Today and onboarding read the API their own way · found in I-11

I-11 added `src/app/(app)/readApi.ts`, one reader for a server page's `/v1` reads
with the request's cookie. Today's `fetchDay` and onboarding's objectives count
(`src/app/onboarding.ts`) still each carry their own copy of the same fetch. Moving
them onto `readApi` changes two working pages, so it waits for a change that touches
them anyway.

### Route validators are copied, not shared · found in I-01

`shared/http.ts` gained `isUuid` in I-01, and the objectives routes use it. Two older
routes still carry their own copies:

- the UUID regex in `app/objectives/[objectiveId]/effort-entries/route.ts`;
- `isIsoDate` in `app/day/[date]/route.ts`, which duplicates the exported one in
  `modules/effort/domain/validateWrite.ts`.

They agree today. The risk is the next route copying whichever it finds first, and one
copy drifting: a date the day route accepts but the effort write refuses is the kind of
disagreement that moves a day (NFR-12). Small to fix, since both routes would import
the shared one. It was left out of I-01 because neither route is in its plan.

### ADR-004 names a variable that no longer exists · found in I-02

ADR-004 gives `SEED_DATA` as its example of configuration that differs between
environments. I-02 removed the seed script and the variable with it: the integration
tests make their own data, and a local sign-in creates its own user. The ADR's rule —
code never branches on the environment's name — is untouched; only the example is
stale. Not edited in I-02, which edits no ADR it does not decide.

### Effort writes are not serialised against status changes · found in I-02

Logging, correcting and deleting an entry (`effort/service.ts`) read the objective's
status and then write in a separate statement, with nothing locked. A pause, complete
or end that commits between the two is not seen: an entry is added, changed or removed
on an objective that is no longer active, which the rule those operations check says
cannot happen. Status changes and plan-end saves already take the objective's lock;
effort writes do not.

Likely only with two tabs open at once, for one user. Closed by taking the same lock
in a transaction around the check and the write. Folding the user check into the
update and delete queries themselves — today they match on the entry id alone, after
the service has checked ownership — belongs in the same change.

### The coverage test has never been seen to fail · found in I-02

`contract-coverage.itest.ts` is what guards "every route is the caller's": it fails
when an operation has no row in `authorization.itest.ts`. Plan step 6 called for
checking that once by hand — remove a row, watch the test fail, put it back — and it
was not done. Until it is, a passing coverage test proves less than it appears to.
Ten minutes; no code changes unless the test does not fail.

### The origin leg is plain HTTP until there is a domain · found in T-07

HTTPS reaches the deployed service through CloudFront on its default
`*.cloudfront.net` certificate (ADR-006 revision 4). Two gaps against NFR-11 remain,
both stated in the ADR: CloudFront talks to the ALB over plain HTTP, across a public
address, carrying the session cookie and entry text; and the viewer leg's TLS floor is
fixed at 1.0. Both close the same way: register a domain, put an ACM certificate on
the ALB (`origin_protocol_policy = "https-only"`), and serve the domain from
CloudFront on a custom certificate under `TLSv1.2_2021`. Cognito's callback and
`APP_BASE_URL` move with it. ADR-006 makes this the gate before any real user's data
goes in.


### A review still returns parked ideas the design no longer shows · found in I-03

The approved design leaves parked ideas out of the review. The contract has not
caught up: `Review.parked_ideas` still returns the ideas caught in the period, with
each verdict as it stood at period end. The ERD's *status then* rule exists to serve
that field. Building it costs `getReviewFacts` a subquery over every idea the owner
has, and `ideaAsOf` in `reviews/domain/assembleReview.ts`. I-03 leaves the field
alone, but a full `ParkedIdea` now carries its notes too, so the review response grows
with them.

Removing it is a contract change (`Review.parked_ideas`) plus an ERD change. It also
decides whether the verdict history still needs *status then* at all. If nothing else
reads the history by date, the verdict table could be simpler, but that is a decision
to make deliberately, not something to remove as a side effect.


### No screen reads the effort month · found in I-03

Once G16 and G18 exist, the Effort tab reads its weeks from `Objective.weeks`, its
entries from `GET /objectives/{id}/effort-entries?from&to`, and each day's target
and tag from `/schedule`. `GET /objectives/{id}/effort` groups days by calendar month
and Monday weeks, which are not plan weeks, and its streak, session count and
days-worked line appear on no screen. Removing it is a contract change: the route,
`effort/domain/effortMonth.ts` and its test, and `effort-month.itest.ts`.

### No screen discards a review draft · found in I-03

**Built in I-13** (2026-11-02): **Discard draft** in the review's sticky bar, with a
confirm, as `05-reviews.md` now designs it. The endpoint stays.

`DELETE /reviews/{id}` is built and tested, but `docs/design/screens/05-reviews.md`
has no Discard action: a draft is only saved and continued. Either the design gains
a Discard button, or the endpoint goes, which is a contract change.

### The user's name, and reading the signed-in user back · found in I-03

**Promoted to I-04** (2026-10-21): the name is Cognito's `name` attribute, carried in the session and returned by `GET /v1/session`.

The shell and onboarding show the user's name ("Signed in as {name}", "Welcome,
{name}", the avatar initial), but the `user` table stores no name and no endpoint
returns the signed-in user (G30 in `docs/design/contract-gaps.md`). I-03 leaves it
out because the sign-in and sign-up screens are not final, and where the name is
asked for depends on them. Two routes: Cognito's sign-up asks for the optional
standard `name` attribute (the app client then needs the `profile` scope, and
whether managed login shows an optional attribute must be checked first, because
making it required replaces the pool), or onboarding asks for it and the app stores
it. Either way, `GET /session` returns the `User` with `name`.

### A monthly review loses minutes where a flexible week crosses its start · found in I-03

`windowFigures` (`reviews/domain/assembleReview.ts`) gives a window the slots that
start inside it and the minutes on its days. A flexible objective's week slots tile
from its segment start, and a monthly window starts on the same day of the month,
so a week slot can begin in one monthly window and end in the next. Its days in the
later window are covered by a slot, so they are not extra, and the slot started
before the window, so they are not credited either: those minutes appear in
`logged_minutes` and nowhere else, and logged = credited + over + extra
(`docs/domain/adherence.md`, rule 7) fails for that window. Weekly windows and plan
weeks never cross a week slot, so only monthly reviews of flexible objectives are
affected. One way out: a week belongs to the window that holds its last day, and its
minutes count there.

### Completing at the final review un-plans the plan's last day · found in I-03

Saving a plan-end review with outcome `completed`, `paused` or `ended` writes the
status event dated the review's `period_end` (ERD invariant 7) — the plan's last
day. `statusOn` treats an event as in force from its own date, so that day is no
longer active: its slot disappears, its target leaves the figures, and effort logged
on it becomes extra. A plan whose last day is a planned day therefore reads one
day short at the end, and the last day's work counts as off-plan. Unnoticed so far
because the story's plan ends on a Sunday. Options: date the event the day after
`period_end`, or have `planSlots` treat a final status as in force from the next
day. Either is a domain rule change (`docs/domain/` and the ERD), with tests.

### `infra/rds.tf` is not `terraform fmt`-clean · found in I-04

One attribute in `aws_db_instance.main` is misaligned (`vpc_security_group_ids`), so
`terraform fmt -check` fails for the whole directory. Nothing checks it in CI, which is
how it got in. Either fix the file, or add the check and fix it with it.

### The sign-in screens keep their own form pieces · found in I-06, narrowed in I-08

`(auth)/ui.tsx` has `Field`, `FieldError`, `described` and `Banner` for the sign-in
screens. Since I-08 the app's screens share one set, `src/app/(app)/form.tsx` (New
objective and Log time). The auth copies read the auth layout's own surfaces
(`--input-bg`), so they were left alone. They agree today; a change to how an error
reads must be made in both places until they are joined.

### Flexible objectives are v2 · found in I-08

A flexible objective's target is a week's, counted over its own week, so Today's summary
could not add it to the fixed objectives' day honestly. I-09 keeps v1 to fixed
objectives: New objective hides the choice and the API refuses a new one. The backend
that reads flexible plans stays, tested. Bringing them back needs: the weekly target
(G40), their weeks on the Monday-to-Sunday week I-09 sets, a short first and last week,
every flexible variant in the design ("Weeks met", "Days worked", "15h / 20h this
week", "1 day left"), and the monthly-review entry above.

### An account whose objectives are all paused sees "Add your first objective" · found in I-08

Today's day read returns active objectives only, so an account whose objectives are
all paused, completed or ended gets the new-account card, which invites it to add its
*first* objective. Telling the two apart needs a second read or a count on the day
(NFR-03). The design has no state for it yet: it needs words ("Nothing is running
today…") and a way back to the paused objective, which arrives with Objectives.

### More logged than planned, yet the ring is under 100 % · found in I-08

Today's big total counts every minute logged, while the ring counts only today's
planned time met, objective by objective, with time over one objective's plan never
covering another's (`03-today.md`, G27). So a day can read "2h 55m logged" against
"2h 45m planned" with the ring at 73 %, because one objective is over and another has
nothing. Adherence works the same way: time over a slot's target is shown as over, not
credited (`docs/domain/adherence.md`, rules 3 and 7). The rule is deliberate, but the
page doesn't say it, and a user can read it as a bug. Rohit will look at how the page
explains it: the summary line, a note on the ring, or showing over-plan time apart.
