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

Empty.
