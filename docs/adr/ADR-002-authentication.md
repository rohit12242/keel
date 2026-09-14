# ADR-002 — Authentication approach

**Decision:** D-07 · **Story:** W3-04 · **Status:** Decided · **Date:** 2026-09-15

> **Amended the same day** to name the provider: **Amazon Cognito, conditional on
> D-06 landing on AWS.** See *The provider* below.

## Context

Keel has one user today. The register said to weigh "what changes if that stops
being true; build versus buy."

Two requirements constrain this:

- **NFR-08** — an open session keeps working for seven days *even when the
  sign-in service is unreachable*. Nobody is signed out because auth is down.
- **NFR-11** — the log holds diary-grade text. Deviation reasons and review
  answers are the kind of sentence you would never want leaked.

## Decision

**Identity is delegated to a managed provider. The session belongs to Keel.**

| Concern | Owner |
|---|---|
| Credentials, password storage, reset flow, rate limiting, MFA later | The provider |
| Session lifetime, the cookie, every authorisation check | Keel |

The provider authenticates **once**, at sign-in. Keel then issues its own signed
HttpOnly session cookie with a real expiry, and validates it locally on every
request with no network call.

The shape above is the same for every provider, which is why the ADR is written
this way: changing provider later does not reopen the decision, it only changes
the sign-in path.

## The provider

**Amazon Cognito — conditional on D-06 landing on AWS.**

**Why, in order:**

1. **You have used it before.** D-02 was settled on *"what I can debug unaided"*.
   That criterion applies here unchanged, and it is the strongest reason on this
   list. Cognito is not the best-regarded product in this category; it is the one
   you can already operate.
2. **It is where D-06 already put you.** One console, one IAM model, one bill, one
   vendor's failure modes to learn rather than two. In a week that already has an
   AWS deployment spike, not adding a second vendor's console has real value.
3. **Free at this size, indefinitely.** The Lite and Essentials tiers include
   10,000 monthly active users at no cost. Keel has one. (Pools created before
   22 November 2024 kept a 50,000 MAU free tier — that is the more generous
   arrangement you may remember from the earlier project.)
4. **Standard OIDC**, so it drops into the boundary above without changing it:
   authorization code flow at sign-in, then Keel issues its own session cookie.

**What is being accepted:**

- **The developer experience is the common complaint** — thinner documentation,
  less helpful errors, more configuration surface, and limited customisation of
  the managed login screens compared with Clerk or Auth0. That criticism is fair.
  It lands hardest on teams building heavily customised consumer sign-up; Keel
  needs email and password for one user, which is Cognito's simplest path and
  where the gap is narrowest.
- **Password hashes cannot be exported from Cognito.** Changing provider later
  means forcing every user to reset their password. At one user that is a shrug.
  It is worth knowing before it is a hundred, and it sharpens the lock-in note
  below: the local `user` row keyed by the provider's subject id protects the
  *data*, not the *credentials*.
- **The pricing model changed in November 2024.** It can change again. Not a
  reason to avoid it at this size, but a reason the revisit trigger below exists.

### The condition, and why it is written down

**D-06's AWS deploy spike has a two-hour hard stop and a named fallback.** If that
spike overruns and deployment falls back off AWS, Cognito's main structural
advantage — same cloud, same console — disappears, and what is left is a
cross-cloud authentication dependency bought for no gain.

**If D-06 falls back, reopen this in the same sitting.** Do not inherit Cognito by
default because it was written down first. These two decisions are coupled, and
until this paragraph existed nothing in the register said so.

## The distinction that matters

"Session managed in the client app" has two readings. They sound the same and only
one works.

**The app owns the session — adopted.** Next.js issues and validates its own
session cookie. The browser holds an HttpOnly cookie it cannot read. The server
render knows who you are because the cookie arrives with the document request.

**The browser holds a token in JavaScript — rejected.** A token in
`localStorage`, sent as a Bearer header. Two problems, and the first is
architectural rather than a preference:

1. **It fights D-04.** Server components cannot read `localStorage`. A
   server-rendered Today screen would have no idea who is asking, so every page
   would have to render empty and then fetch — which is the fan-out NFR-03 exists
   to prevent, arriving through the back door.
2. **Any script on the page can read it.** For a product whose whole content is
   "I stopped because I felt like a fraud", that is the wrong default. An
   HttpOnly cookie is not readable by JavaScript at all.

## Why a managed provider — the honest reason

Employability is a real reason and it is consistent with D-06. It is also **not
the strongest reason here**, and the record should say so.

The strongest reason is NFR-11. Hand-rolled authentication means owning password
hashing, single-use reset tokens, timing-safe comparison, rate limiting, and a
breach response. Each is easy to get subtly wrong, none of them is visible when
wrong, and the cost of being wrong is the diary.

The employability argument is genuine but smaller than it was for AWS: "integrated
an identity provider" is a more modest line than "ran infrastructure on AWS".
What does carry is the surrounding knowledge — OIDC flows, token validation,
session design — which is common interview ground.

## Consequences

**Good**

- NFR-08 is satisfied by construction, not by effort. Session validation makes no
  network call, so the provider being unreachable cannot sign anyone out.
- Keel never stores a password. The worst credential incident it can have is one
  it did not cause.
- Sign-up, reset and lockout flows arrive built and tested.

**Costs accepted**

- A vendor dependency in the sign-in path. Sign-in fails while the provider is
  down; existing sessions do not (that is the whole point of the boundary).
- Users live in two systems. NFR-11's export-and-delete now spans both, and a
  delete that clears Keel but leaves the provider is not a delete.
- A monthly bill at some user count, though not at one.

**Mitigation for lock-in**

Keep the local `user` row from the ERD, keyed by the provider's subject id as an
external identifier. Every Keel row points at the local user, never at the
provider's id directly. Changing provider then means re-mapping one column rather
than re-keying the database.

## Contract impact — three endpoints change

`keel-api.yaml` currently has Keel owning account creation and password reset.
This decision moves them.

| Endpoint | What happens now |
|---|---|
| `POST /users` | Replaced. Account creation happens at the provider; Keel creates its local user row on first sign-in. |
| `POST /password-resets` | Removed. The provider owns it. |
| `POST /password-resets/{token}` | Removed. |
| `POST /session` | Becomes the OIDC callback that exchanges Cognito's authorization code for a Keel session cookie. |

This is logged as **G-13** in the gap list. It also means the fix made for G-01
and G-02 two days ago is partly superseded — which is normal, and worth noting
because it is the cost of writing a contract before the decisions behind it are
all closed.

## Revisit when

- Keel has more than one user and the bill becomes visible.
- The provider changes its pricing or its terms.
- MFA or social sign-in is wanted — at which point this decision starts paying
  back rather than costing.
- **D-06 falls back off AWS.** Then the provider choice above loses its main
  argument and should be made again, not assumed.
- Cognito's pricing model changes again, as it did in November 2024.
