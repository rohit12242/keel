# Keel — product brief

Sprint 00 · Week 1 · stories W1-02 and W1-03
Written 3 September 2026

---

## 1. One line

If you're working alone toward an objective, Keel keeps a daily trail of your effort and
what pulled you off it — so that the record, not your memory, decides what you do next.

---

## 2. The problem

For years my pattern has been to think a great deal in my head, make a plan, work to it for
a few days, and then be pulled away — by an event, by a new idea, by a better-looking path,
or by self-doubt about whether this was the right path at all. Then more thinking, a new
plan, and the loop repeats. I have also repeated the same research and arrived at the same
conclusion more than once. More thinking, less progress.

The cost is that nothing compounds. Two years of real effort produced several restarts
rather than one deep skill, and two interviews failed on the same fundamentals gap — which
is a depth problem, not a wrong-field problem. Every switch reset the clock. And at review
time I had only scattered notes and memory, so I could never tell whether I had worked too
little, worked on the wrong things, or simply stopped too early.

---

## 3. Who it is for — and who it is not

Keel is for someone working alone toward a hard objective, with no external structure
holding them to it — no manager, no cohort, no deadline set by anyone else. Job seekers,
career switchers, self-taught learners, solo builders. Someone who is putting in real effort
and cannot explain why it is not adding up.

It is not for people who already have a guiding ecosystem and are thriving inside it. Not
for teams. And not for people whose problem is not knowing *what* to do — that is coaching,
and a different product.

---

## 4. Why now

Two reasons, on different timescales. A year ago I had not named the switching pattern — I
could see the results but not the shape. Now I can, which makes it possible to build
something aimed at the pattern rather than at productivity in general.

Separately, I am building a product now because I want to learn end-to-end product
development, which is what the roles I am applying for require. AI tooling makes it
realistic for one person to design, build and ship something real in weeks rather than
months.

---

## 5. What it does

Keel is a logbook. You declare an objective with a plan — which days you will work, how many
hours on each — and then each day you log your sessions and what pulled you off them. About
a minute a day. Deviations are declared by you, never guessed by the app; ideas that arrive
mid-objective go to a parking lot instead of into your week.

Say someone starts learning a programming language, decides after a few days that business
would be a better objective, switches, then some days later decides programming was the
right choice after all. That loop is the blocker. In Keel each switch is logged, each idea
parked, and at review the repeated pattern is plainly visible.

Declaring helps from day one — that is the keel. The evidence compounds afterwards: at
review you see effort against the plan you set, and the record, not memory, decides whether
you continue.

---

## 6. What it deliberately does not do

**1. No task lists or low-level plans inside Keel.** Keel is not a project management tool.
The low-level plan for an objective lives in a spreadsheet; Keel's scope is recording drift
evidence only. The unit that matters here is the day, not the task.
*Would change if:* a completed review shows that day-level effort isn't enough to explain
what actually happened.

**2. No AI features in v1.** I am building full-stack fundamentals first, and AI can be
layered on top of v1 rather than designed into it.
*Would change if:* v1 holds real data from at least one completed objective — then AI has
something honest to work with.

**3. No streaks, badges, or guilt notifications.** Keel's purpose is to provide evidence,
not to apply pressure. A missed day is answered with a small task, never with a broken
streak.
*This is a stance rather than a sequencing decision — I don't expect to revisit it.*

**4. No sharing, accountability partners, or social features.** The honesty of the record
depends on nobody else ever reading it. The moment someone can see my deviations I will
start logging flatteringly, and the data stops being worth having.
*Structural, not a roadmap item.*

---

## 7. Success measures

1. At my first review, I continue or change the objective based on what the app shows rather
   than what I remember — and I can point at the screen that decided it.
2. I log on at least 80% of planned days across one complete objective, and at least one
   deviation gets logged on the day it happened.
3. At least two ideas get parked during an objective, and none of them is acted on before
   its review date.

All three by the end of my first completed objective in Keel, and no later than
**30 November 2026**.

---

## 8. What already exists

The closest product is **Intend** (formerly Complice). Its philosophy is close to mine — you
account for what you did rather than being penalised for what you didn't — but it has no
schedule model, no adherence against a declared plan, and no concept of recording a
deviation.

**Beeminder** is the other well-known commitment tool, but its mechanic is financial stakes
against a numeric graph. Keel makes the opposite bet: no penalty, just a record you cannot
argue with later.

**Automatic time trackers** such as RescueTime and Rize capture what happened far better
than I ever will, but they measure activity rather than commitment — nothing about a plan
you declared, and nothing about why you stopped.

What none of them do: record a deviation *you* declare, tagged to a pattern you named, and
treat the review as the main event rather than a report at the bottom of a dashboard.

---

## 9. Constraints and assumptions

### Delivery constraints

One person building it. About four hours a day, alongside two hours of Python and DSA.
Roughly ten weeks. No budget beyond hosting.

### Product constraints in v1 — which follow from the above

One user, with no multi-user model behind it. Fixed-weekday scheduling only; flexible weekly
mode is designed into the schema but not built. A schedule is set when the objective is
created and does not change mid-objective.

### Assumptions

**1a.** At a review, evidence produces a better-informed continue-or-switch decision than
memory does.
*I would notice if false:* I open the review, glance at it, and decide the way I would have
anyway.

**1b.** Better-informed decisions, across several objectives, reduce the number of needless
restarts.
*I would notice if false:* three objectives in, the loop looks exactly like the last two
years, only better documented.

**2.** Declaring an objective — its schedule, its daily target, its review date — is itself
enough to change what I do that day, before any evidence exists.
*I would notice if false:* the first week of an objective looks no different from the week
before it.

**3.** About a minute a day is short enough that logging survives a bad day.
*I would notice if false:* gaps in the log cluster on exactly the days I deviated.

**4.** A thirty-day window is long enough for a pattern to become visible.
*I would notice if false:* the first review shows nothing I did not already know.

---

## 10. Risks

**1. I abandon Keel around week five, for a reason that feels excellent at the time.**
The most likely failure by some distance, and the one the product exists to address.
*Action:* the delivery plan's guardrails — new ideas to the parking lot rather than into the
sprint, a written decision record for any reversal, a missed day answered with 45 minutes
rather than a catch-up marathon, and Keel's own build tracked as an objective once the app
can hold one.

**2. The decisions become better informed and the restart loop continues anyway.**
Assumption 1b turns out to be false.
*Action:* decide at the first review what would count as evidence of this, and if it holds
after two objectives, reconsider the thesis rather than the interface.

**3. The data isn't good enough for the review to mean anything.**
Entries written in batches on Sunday, round numbers, deviations left unlogged.
*Action:* keep logging to about a minute with no required fields beyond minutes and one
line, and at review look for the tells — clustered entry times, suspiciously round figures,
weeks with effort but no deviations.

**4. People won't use it because they don't want their record in someone else's system.**
Real, but a distribution risk for a product that currently has one user.
*Action:* nothing in v1; revisit only if I ever put it in front of someone else.

---

## 11. Open questions

1. Does the record actually change my decisions, or only document them?
   *I will know after three completed objectives — roughly February.*

2. **Will I log a deviation on the day I deviate?** The days I go off are the days I least
   want to write it down. If deviation logging only happens when I am already feeling good,
   the review data is systematically biased and the feature quietly fails.
   *Watch from the first objective onward.*

3. Is a fixed-weekday schedule enough, or does real use demand the flexible weekly mode?
   *I will know by the end of the first objective run alongside the product build.*

---

## Notes for later

- **Seed "self-doubt" as a named pattern.** It is one of my recurring causes of drift and it
  is distinct from the five currently planned. It does not announce itself as a switch — it
  arrives as "am I even on the right path", which feels like careful thinking.
- **Parked:** the idea that this skill could later generate value for local businesses. A
  separate bet; judge it with evidence rather than leaving it in the brief as settled.
- **Carried into the backlog:** logging must take about a minute — one click to reach,
  defaulting to today and to the objective scheduled for today, requiring nothing beyond
  minutes and one line. Anything that adds a step breaks the promise made in section 5.
- **Before this is final:** open Intend, Beeminder and one automatic time tracker for ten
  minutes each. Do not sign a competitive analysis you have not personally looked at.
