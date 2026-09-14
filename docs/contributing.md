# Contributing

One developer, one user. These conventions exist so the repository and the
sprint sheet still agree with each other at retrospective — not to add ceremony.

## Branching

- `main` is always deployable. Never push to it directly.
- Work on short-lived branches. Name them for the story: `w3-14-log-entry`.
- Merge through a pull request. The blocking checks must pass first.

A ruleset on `main` enforces this: pull request required, direct pushes blocked,
linear history (no merge commits — rebase or squash).

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org/), with one addition:
**every commit ends with a `Story: W3-xx` footer.** The story id is how the sprint
sheet and the repository stay connected.

```
<type>(<scope>): <summary>

<body — what changed and, more importantly, why>

Story: W3-xx
```

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
cross-cutting area: `ci`, `db`, `contract`.

### Rules

- Summary in the imperative, ≤ 50 characters, no trailing period:
  "log an entry", not "logged an entry" or "logs an entry."
- The body explains **why**. The diff already shows the what.
- The `Story: W3-xx` footer is required on every commit.

### Example

```
feat(effort): log an entry against a plan slot

Entries carry local_date and tz from the client. `extra` is derived,
not stored — see ADR-001.

Story: W3-14
```

### The template

A commit template lives at `.gitmessage`. Point your local clone at it once:

```
git config commit.template .gitmessage
```

Then `git commit` (no `-m`) opens an editor pre-filled with the shape and a
reminder of the allowed types and scopes.

## Pull requests

The PR template asks for two things: the **story id**, and confirmation that the
**review gate** was walked — the relevant items from the Definition of Done in
`docs/definition-of-done.md`. Fill both in. A PR with an empty story id is a PR
that cannot be traced back to the sprint sheet.
