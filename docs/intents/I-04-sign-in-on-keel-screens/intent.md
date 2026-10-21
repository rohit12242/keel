# I-04 — Sign in on Keel's own screens

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-10-21 · **Accepted:** 2026-10-21

## Intent description

Signing in, creating an account and resetting a password happen today on Cognito's
managed login pages. The approved design has Keel's own screens for all three. This
intent moves authentication behind those screens: Keel's pages collect the
credentials, and the browser proves them to Cognito directly, so the password still
never reaches Keel. The session stays Keel's own cookie, exactly as it is now.

## Proposed outcome

An account can be created and confirmed, signed in to, signed out of and have its
password reset, all from Keel's pages, with no Cognito-hosted page in the way. Once
signed in, the browser holds nothing but Keel's session cookie.

## How we know it worked

The whole account journey — create, confirm, sign in, reset, sign out — runs on the
deployed service without ever showing a Cognito page. No password reaches Keel's
server or its logs, no token is left in the browser once sign-in completes, and a
Cognito outage still does not end a session that is already open.

## Out of scope

The screens themselves — the design is being updated for the code-entry step. MFA.
Social sign-in.
