# Spec — I-07 · The server knows the user's zone

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-10-23 · **Accepted:** 2026-10-23

The contract is `POST /v1/session` in `docs/keel-api.yaml`, which now takes `tz`.
What `user.tz` means is in `docs/erd.md`, *User*. This file does not repeat them.

## What must be true

**Signing in records the zone**

- Every sign-in sends the browser's zone with the ID token. The first sign-in after
  creating an account is no different.
- A successful sign-in stores that zone as the user's: a new user is created with it,
  and an existing user's zone is replaced by it. Nothing else changes the zone.
- A zone the server does not know refuses the sign-in as invalid, naming `tz`. Nothing
  is written, and no session is issued. The sign-in screens show it as they show any
  other failed exchange.
- Signing in from a zone other than the stored one is how the stored zone changes.
  Nothing between two sign-ins does.

**Today opens on the user's day**

- Today always opens on today in the user's stored zone, on the first response: no
  loading step, and no second request to find the day.
- Today takes no date from the URL. A `?date=` left in an old link is ignored, and
  `?reset=done` still shows its notice.
- Reading the zone does not change what a session is: who is signed in is still read
  from the cookie alone (ADR-002).

**The server's own "today"**

- Every check the server already makes against today in the user's zone — a deviation
  dated in the future, an extension that must end after today, a parking lock — uses
  the stored zone. None of them changes; the zone they read is now real.

**What does not change**

- Every recorded date still comes from the client (NFR-12). The New objective page
  still sends the browser's day and zone.
- The session cookie, ADR-002, and `GET /v1/session`.
- No migration: `user.tz` exists and is NOT NULL.
- No new runtime dependency.

## Out of scope

Travel: a zone that changes while the user stays signed in is picked up at the next
sign-in. Choosing a zone by hand. DST rules (NFR-12, v2). Today's redesign.
