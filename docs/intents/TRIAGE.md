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

### A new user's zone is UTC, and nothing can change it · found in I-02

`user.tz` is NOT NULL, and a first sign-in creates the user (ADR-002). The sign-in
carries no zone — the contract's callback has nothing to take one from, and the pool
asks for no `zoneinfo` — so `session/repo.ts` writes `UTC`. No operation changes it.

Recorded dates are unaffected: every one comes from the client (NFR-12). What is
affected is every comparison the server makes against *today in the user's zone* — a
deviation dated in the future, an extension that must end after today, whether a
parking lock has lifted. For someone in Asia/Kolkata, "today" turns over 5½ hours
late. An intent that lets a user set their zone, or takes it at sign-in, closes this.

### ADR-004 names a variable that no longer exists · found in I-02

ADR-004 gives `SEED_DATA` as its example of configuration that differs between
environments. I-02 removed the seed script and the variable with it: the integration
tests make their own data, and a local sign-in creates its own user. The ADR's rule —
code never branches on the environment's name — is untouched; only the example is
stale. Not edited in I-02, which edits no ADR it does not decide.
