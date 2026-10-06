# Contributing

One developer, one user. These conventions exist so an intent and the commits that
deliver it still agree with each other months later — not to add ceremony.

## Branching

- `main` is always deployable. Never push to it directly.
- Work on short-lived branches. Name them for the intent: `i-01-declare-an-objective`.
- Merge through a pull request. The blocking checks must pass first.

A ruleset on `main` enforces this: pull request required, direct pushes blocked,
linear history (no merge commits — rebase or squash).

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org/), with one addition:
**every commit ends with a footer naming what asked for it.**

| Footer | For |
|---|---|
| `Intent: I-nn` | work an intent asked for |
| `ADR: nnn` | platform work — CI, hooks, guards — whose intent is an ADR |
| `Chore: <what>` | housekeeping nothing asked for: a stale document, a rename |

The point of the footer is that months later you can tell what asked for a change,
and the three cases are genuinely different: `Chore:` says plainly that nothing did.

```
<type>(<scope>): <summary>

<body — what changed and, more importantly, why>

Intent: I-01
```

`Story: W<week>-<nn>` is the historical form, used before the move to intents. It is
still accepted so those commits keep validating — see `scripts/check-commits.mjs` —
but new commits use `Intent:`.

### Type

| Type | For |
|---|---|
| `feat` | a user-facing capability |
| `fix` | a defect in shipped behaviour |
| `docs` | documentation only |
| `refactor` | behaviour-preserving code change |
| `test` | adding or correcting tests |
| `chore` | tooling, config, repository plumbing |

### Scope

The module — `effort`, `objectives`, `reviews`, `parking`, `time` — or a
cross-cutting area: `ci`, `db`, `contract`, `infra`.

### Rules

- Summary in the imperative, ≤ 50 characters, no trailing period:
  "log an entry", not "logged an entry" or "logs an entry."
- The body explains **why**. The diff already shows the what.
- A footer is required on every commit — `Intent:`, `ADR:` or `Chore:`.

### Example

```
feat(objectives): create an objective, its segment and its first event

All three rows commit or none do: an objective without a created event
has no status at all (ERD invariant 16).

Intent: I-01
```

### The template

A commit template lives at `.gitmessage`. Point your local clone at it once:

```
git config commit.template .gitmessage
```

Then `git commit` (no `-m`) opens an editor pre-filled with the shape and a
reminder of the allowed types and scopes.

## Pull requests

The PR template asks for the **intent id**, which plan steps the PR covers, and four
short sections. It carries one checkbox that only Rohit ticks. Fill it in as the
template asks; the template itself says what belongs in each section and what does
not.

Keep the body to one screen. The intent, spec and plan are in the diff — do not
restate them. One commit per plan step, and the plan is committed first: see
`docs/intents/README.md`.
