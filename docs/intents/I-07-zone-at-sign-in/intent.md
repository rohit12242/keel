# I-07 — The server knows the user's zone

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-10-23 · **Accepted:** 2026-10-23

## Intent description

Every user is stored in UTC, because signing in carries no zone. So the server's
own "today" is wrong for anyone outside UTC: a deviation dated in the future, an
extension that must end after today, whether a parking lock has lifted. Today has
to ask the browser for its day on every visit (I-06), which costs an extra render
and a loading flash.

## Proposed outcome

Signing in, including the first sign-in after creating an account, records the
zone the user is in. Today opens straight on the user's day, and the server's
checks against today use the same day.

## How we know it worked

On the deployed service, a user in Asia/Kolkata signs in between 00:00 and 05:30
IST, opens Keel, and Today shows the IST date on the first load, with no loading
step. A new account's stored zone is its browser's, not UTC.

## Out of scope

Travel: a zone that changes while the user stays signed in is picked up at the next
sign-in, not before. Choosing a zone by hand. DST rules (NFR-12, v2).
