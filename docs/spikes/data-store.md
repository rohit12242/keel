# Keel — data store spike (W2-07)

**Output shape the story asks for:** a shortlist of two, the criteria, and what you still don't know.

## Landscape

| Family | Examples | Verdict |
|---|---|---|
| Relational (SQL) | Postgres, MySQL, SQLite | Shortlisted |
| Document | MongoDB, DynamoDB single-table | Ruled out |
| Key-value / graph / time-series | Redis, S3, Neo4j | Not applicable |

## Why document stores are out — and why that settles D-03

Two of Keel's own requirements do the eliminating:

1. **The Today query reads across objectives.** Today shows every objective's slots for one date.
   A document per objective means reading every objective document and filtering in app code.
2. **The review screens aggregate.** Minutes per week, adherence ratios. In a document store those
   are app-side loops or maintained rollups — and **NFR-09 explicitly forbids reaching for
   denormalised rollups**, because Keel has no scale problem.

So **D-03 = relational, entries as rows.** Which engine is a second, smaller decision.

## Shortlist

### Option A — PostgreSQL (recommended)

- Real `date` type, distinct from timestamps. NFR-12 needs the day-the-user-meant stored as a day.
- Database-enforced constraints; a unique key makes a replayed offline write harmless.
- Most transferable — the engine job listings name.
- Runs on AWS as RDS, which is the operational learning D-06 was chosen for.
- **Cost:** db.t4g.micro ≈ $11.50/month + ~$2–3 storage. Free 12 months on a new account's free tier.
  Aurora Serverless v2 scales to zero but adds cold starts.
- **Burden:** VPC, security groups, connection limits. Real work.

### Option B — SQLite (fallback)

- One file. No server, no cost, no configuration. Sufficient for a decade at 1,680 rows/year.
- NFR-01's restore drill becomes copying a file — a drill that easy is one you'll actually run.
- Same SQL, so the learning isn't wasted.
- **No date type.** Dates are TEXT/INTEGER by convention; NFR-12 rests on discipline, not schema.
- **Needs durable local disk.** Fine on one container/EC2 with a volume; fails on Lambda.

## Why Postgres, ranked

1. **NFR-12 is the hardest requirement and this is where types help.** A day that moves corrupts
   every number Keel shows. Postgres refuses to confuse `date` with `timestamptz`; SQLite lets you
   write it correctly and incorrectly with equal ease.
2. **NFR-06 needs identity before the server sees the entry** — client-generated keys, replay-safe
   writes. `uuid` type + unique constraint makes the replay a no-op.
3. **It transfers.** Partly a CV. Not a technical argument, and recorded as itself.
4. **Cost is bounded** — ~$14/month, free year one. Worth stating, since "cost at zero users" is in
   the register.

## What this implies for Thursday's ERD

| Column | Type | Why |
|---|---|---|
| `id` | uuid | Client-generated before the server sees it (NFR-06). Time-ordered UUID so rows sort by creation. |
| `user_id` | uuid | On every table, in every WHERE clause (NFR-10). Free now, expensive to retrofit. |
| `local_date` | date | The day the user meant. What streaks and adherence count. Stored, not derived (NFR-12). |
| `logged_at` | timestamptz | The actual instant. Separate from `local_date` on purpose. |
| `tz` | text | The zone it was logged in. Without it you can't reconstruct what happened. |
| `UNIQUE (id)` | constraint | Replayed offline write becomes idempotent at the database, not in app code. |

## What the two hours must prove

Not which is faster — NFR-09 settled that neither is. Three checks, in order:

1. **Write the Today query.** One query, all objectives' slots and entries, one date, one user.
   *If it needs more than one round trip, NFR-03 is at risk and the schema is wrong, not the engine.*
2. **Run NFR-12's test.** Insert at 23:55 local, change session timezone, read back, assert the date
   didn't move. Then across a DST boundary. *This is the check that could change the recommendation.*
3. **Do a restore and time it.** Back up, drop a table, restore, diff. *If it takes forty minutes and
   eleven steps you won't do it, and NFR-01 is already broken.*

An unrun check at the two-hour stop is a legitimate result. Write it down.

## What you still don't know

- **Connection limits.** Small RDS instances allow few connections; serverless handlers open them
  freely. If D-06 lands serverless, you need pooling.
- **The two-device conflict.** Phone and laptop both log Tuesday offline. Database constraint or
  application rule? Take it to the ERD as a question.
- **Whether NFR-06 survives.** D-04 is unanswered. If offline logging is relaxed for v1, half the
  client-id reasoning can wait — but decide it, don't discover it.
- **Free tier coverage.** Twelve months, new accounts, specific instance classes. Confirm for your
  account before relying on it.

## One-line answer

Relational, PostgreSQL. SQLite is the fallback and becomes right if the AWS spike overruns —
a running product on a file beats a correct database you never finished configuring.
Decide that trade now, not at 6pm on Wednesday.
