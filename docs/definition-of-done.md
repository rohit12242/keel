# Keel — Definition of Ready and Definition of Done

**Story W3-02** · written once, applies to every story from now on.
Not per story, not per sprint. Changed only at a retro, never mid-week and never
to let a particular story through.

Acceptance criteria are the separate, per-story thing — they live in the
**Output** column of the sprint sheet and you set them when you pick the story up.
These two lists are what is true of *all* stories.

---

## Definition of Ready

A story may be started when all six are true.

**1. The output is concrete enough to picture.**
You can say what will exist when the box ends, in a sentence, without using the
word "work". "A migration creating five tables" passes. "Set up the database"
does not.
> *Why:* W1-02 ran 16 hours against a 2-hour estimate. It was never a bad
> estimate — the output was never defined, so there was no moment at which it
> was finished.

**2. It is a story, not a spike in disguise.**
If the honest answer to "what exists at the end" is *I will know when I get
there*, it is a spike. Spikes get a hard stop and "unfinished" is an acceptable
result. Stories do not get that, so mislabelling one is how a week disappears.

**3. It fits in one box, and you believe the box.**
A story needing two boxes is two stories. On Monday you change any box you do not
believe — a box you inherited is not a box you own.

**4. Every decision it depends on is closed, or the assumption is written down.**
If a story rests on something still open in the decision register, name the
assumption in the Notes column before starting. An unnamed assumption is the one
that costs a rewrite.

**5. Its review gate is written before the work starts.**
The one thing you must be able to explain afterwards, decided up front. Written
at the end, it becomes a description of whatever you happened to learn — which is
not a test of anything.

**6. Fewer than three stories are already in progress.**
Being mid-three things is not a state you can start a fourth from.

---

## Definition of Done

### Every story — all four

**1. The output exists and you can point at it.**
The thing named in the Output column, in a file, in the repo, or in `Keel_doc`.
Not "mostly there".

**2. You can explain it unprompted — and name one thing you would change.**
The review gate. The second half matters more than the first: understanding you
cannot criticise is usually recognition, not understanding.
> *Why:* this is the clause that decides whether the new working mode is learning
> or outsourcing. It is the only one that cannot be satisfied by Claude.

**3. The actual hours are in the sheet, including the embarrassing ones.**
A sheet with honest numbers is worth more than a sheet with good ones. Keel is a
product about exactly this; a tracker you round is a tracker you cannot learn from.

**4. Anything it changed or revealed is written where you would look for it.**
A decision made goes in the register. A gap found goes in the gap list. A rule
discovered goes in the ERD or the contract. Found and unrecorded is the same as
not found.

### Additionally, if the story touched code — all four

**5. The pipeline is green — on the pipeline, not on your laptop.**
Lint, typecheck and tests. "It works on my machine" is the specific thing Sprint
01 exists to make impossible.

**6. It reached main through a pull request, with the checks blocking the merge.**
D-09's whole argument was that ceremony is only worth keeping if something
automated happens inside it. Merging around it removes the only reason it exists.

**7. No NFR was quietly broken.**
In practice one question: did this store an aggregate, or a date that could move?
NFR-09 and NFR-12 are the two a normal day's work can breach without anyone
noticing.

**8. The failure path exists, not just the happy one.**
Every endpoint the contract declares failing, fails that way. NFR-07 is a
requirement, not an aspiration, and this is where it gets checked.

---

## Deliberately not in the Definition of Done

Your W3-02 review gate asks what your DoD excludes on purpose. Four things, and
the reasons matter more than the list.

**Peer review.** There is no peer. A DoD that pretends to be a team's is a DoD
you will quietly stop reading. Clause 2 is the honest substitute.

**A code coverage threshold.** D-08 chose one, and W3-23 revisits it on Friday.
Until that is settled, putting a number here would give it a legitimacy it has
not earned. The four NFR checks are doing this job meanwhile.

**"Documented".** Too vague to block a merge on, which means it would be skipped,
which would teach you that clauses here are optional. The build log covers the
narrative; the contract and the ERD cover the specifics.

**Deployed to production.** Not every story deploys, and the pipeline decides when
deployment happens. Putting it here would make the DoD lie for most stories.

---

## How to use it

Pin it where you tick stories. Check it at the moment you change Status to Done —
not on Friday, when the answer is always yes.

Change it only at a retro. **A clause you weaken because a particular story
cannot meet it is a clause you have deleted**, and the story you weakened it for
is exactly the one that needed it.

The test for whether a clause belongs here at all: *would you block a merge on
it?* If not always, it is a preference. Preferences do not go in definitions.
