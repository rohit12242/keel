# `docs/intents/` — the chain, one folder per intent

Keel is built one **intent** at a time. An intent is one user-visible change, small
enough to state in a sentence with no "and" in it.

```
docs/intents/I-01-create-an-objective/
  intent.md    why this exists, what changes for the user, how we know it worked
  spec.md      what must be true when it is done, and what constrains it
  plan.md      the ordered steps that get there, written by Claude Code
```

All three are committed in the pull request that implements the intent, so the
reviewer running in CI can read them. They are project documents, like the ADRs and
the contract — not tracking material.

## The order, and the one gate

1. **Intent** — Rohit writes it. For platform work (CI, hooks, guards) the **ADR is
   the intent**; no `intent.md` is needed, and `spec.md` names the ADR instead.
2. **What already exists** — checked before anything is specified. Half of what an
   intent seems to need is usually already built.
3. **Spec** — what must be true, not how. No ordered steps, no open decisions, no
   measurement presented as a requirement.

   **Open decisions are answered here, not escalated.** A question the intent leaves
   open — a contract field, a mapping, where a rule lives — is decided while the spec
   is written, and every such decision appears in a **Decisions taken here** list at
   the top of `spec.md`, each with one line of reason. Rohit's read of that list is
   the approval, which is why it is a list at the top and not prose in the middle.

   Three things stop and ask instead of being decided: anything needing an **ADR**, a
   contract change affecting a feature **outside** this intent, and anything
   irreversible in production. Those outlive the intent, so they are not the intent's
   to settle.
4. **Plan** — written by Claude Code after reading the code, never by someone
   reasoning from the documents alone. Numbered steps; each names what it changes,
   its test, and why `main` is still deployable after it.
5. **Rohit accepts the plan.** `plan.md` carries `Status: ACCEPTED <date>`, is
   committed **first and alone**, and nothing is implemented before that commit
   exists. A plan that exists is not a plan that was agreed.
6. **Build** — one commit per plan step.
7. **Review** — the Claude PR review in CI, against `REVIEW.md`.
8. **Rohit merges.**

## Naming

| | |
|---|---|
| Intent id | `I-01`, `I-02`, … |
| Folder | `docs/intents/I-nn-<slug>/` |
| Branch | `i-nn-<slug>` |
| Commit footer | `Intent: I-nn` |

`Story: W<week>-<nn>` is the historical form, still accepted by
`scripts/check-commits.mjs` so the commits before Sprint 03 keep validating.

## Out of scope is not out of mind

A finding that is real but outside the running intent goes to `TRIAGE.md`. It never
becomes an extra step in the plan it interrupted. Sprint 02 grew from 26 stories to
32 by doing exactly that.
