# `docs/intents/` — one folder per intent

An intent is one feature a user would name: "declare an objective", "log effort",
"see the week".

```
docs/intents/I-01-declare-an-objective/
  intent.md    what this is, what changes for the user, how we know it worked
  spec.md      what must be true when it is done
  plan.md      the ordered steps that get there
```

All three are committed in the pull request, so the CI reviewer can read them.
`intent.md` and `spec.md` carry `Status: Drafted` until Rohit accepts them.

## The order

1. **Intent** — Rohit writes it: what and why, no files, fields or steps. For platform
   work the **ADR is the intent**; `spec.md` names the ADR and there is no `intent.md`.
2. **What already exists** — checked before anything is specified.
3. **Spec** — what must be true, not how. No steps, no open decisions.
4. **Plan, drafted** — written by Claude Code after reading the code, `Status: Drafted`.
5. **Plan, interrogated** — Rohit asks what the change could break, which step is most
   risky, and what Claude chose not to do. The answers go into the plan.
6. **Rohit accepts the plan.** `plan.md` carries `Status: ACCEPTED <date>` and is
   committed first and alone. Nothing is implemented before that commit exists.
7. **Build** — one commit per plan step.
8. **Review** — the Claude PR review in CI, against `REVIEW.md`.
9. **Rohit merges.**

An accepted `plan.md` has four sections:

| | |
|---|---|
| Files that change | every file, grouped by step |
| Order of work | numbered steps, one commit each |
| Risks | what could break, which step is riskiest, what was not chosen |
| Proof | the test per step, and why `main` stays deployable |

## Where things go

**Design** — a contract field, a column, an invariant, a state rule — goes in the
document that owns it (`docs/keel-api.yaml`, `docs/erd.md`, `docs/adr/`,
`docs/nfrs.md`), in the same commit as the spec. `spec.md` points at them, never
repeats them.

**Small decisions** are taken while the spec is written and are not logged anywhere.
If one changes design, the design document is the record.

**Three things stop and ask** instead: anything needing an ADR, a contract change
affecting a feature outside this intent, anything irreversible in production.

**Out-of-scope findings** go to `TRIAGE.md`, never into the running plan. `TRIAGE.md`
is for work, not decisions.

## Naming

| | |
|---|---|
| Intent id | `I-01`, `I-02`, … |
| Folder | `docs/intents/I-nn-<slug>/` |
| Branch | `i-nn-<slug>` |
| Footer, feature work | `Intent: I-nn` |
| Footer, platform work | `ADR: nnn` |
| Footer, anything else | `Chore: <what it was>` |

`scripts/check-commits.mjs` enforces these.
