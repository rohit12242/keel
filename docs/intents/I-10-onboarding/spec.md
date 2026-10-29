# Spec — I-10 · Onboarding

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-10-29 · **Accepted:** 2026-10-29

The design this needs is in the repository: Onboarding in
`docs/design/screens/02-auth-and-onboarding.md`, the New objective form in
`04-objectives.md`, and G11 and G34 in `docs/design/contract-gaps.md`. The contract is
`GET /v1/objectives`, `POST /v1/objectives` and `GET /v1/session`. This file does not
repeat them.

## What must be true

**When it shows**

- Keel opens onboarding instead of Today for an account with no objective at all, in
  any status, unless that account has skipped it in this browser (G11). That covers
  the sign-in right after confirming an email, and any later visit until the account
  skips or creates an objective.
- Leaving part-way resumes at step 1. A skip is remembered for that account in that
  browser only; another browser shows onboarding again until the account skips there
  or has an objective. Another account on the same browser is not affected by it.
- An account with an active objective opens Today with one read of the day, as now
  (NFR-03). Only an account with nothing on Today pays for the check.
- Onboarding sits outside the frame: no sidebar or tab bar, its own top bar and
  progress, as designed. Opening it without a session goes to Sign in.

**The three steps, as designed**

- Step 1 reads as designed, with the user's name from the session. **Skip** lands on
  Today's empty card and is remembered; **Next** goes to step 2.
- Step 2 is the New objective form, the same one I-06 built — the same checks, words,
  preview and rules — with this step's title, lead, defaults, placeholders and tips.
  Fixed only (I-09); no "Start from" card. **Back** returns to step 1 and keeps what
  was typed.
- **Create objective** sends one request, whatever the clicks, as New objective does,
  and goes to step 3, not Today. If it fails, what was typed stays and the page says
  nothing was created.
- Step 3 shows the objective just created: its schedule line and the three tiles, with
  the first review from the objective itself (G34), never a second rule. All three
  daily rows — Log time, Log a deviation, Park an idea — show as designed.
  **Go to Today →** lands on Today with the objective on it.
- Once the objective exists, onboarding no longer opens: reloading step 3, or the
  browser's back button, goes to Today, and nothing is created twice.
- Desktop and phone as designed: the tips column on desktop only, the pinned primary
  button on phone.

**What does not change**

- The API and the contract. The sign-in screens, apart from where a new account lands.
- New objective, which step 2 reuses rather than copies. No new runtime dependency.
- Accessibility as `01-shell.md` sets it.

This closes the TRIAGE entry "A confirmed account lands on Today, not onboarding".

## Out of scope

Logging a deviation and parking an idea — step 3 describes them, their screens make
them work. Starting from an approved idea. Flexible objectives (v2).
