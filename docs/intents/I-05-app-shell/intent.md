# I-05 — The app shell

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-10-22 · **Accepted:** 2026-10-22

## Intent description

Only the sign-in screens wear the Keel Modern design today. Every signed-in page
still uses the old look, and Today carries a stop-gap "Signed in as" line and Sign out
button. The approved design puts every page inside one frame — `docs/design/screens/01-shell.md`.
This intent builds that frame, so each screen built after it only has to fill it.

## Proposed outcome

Every signed-in page sits in the Keel Modern frame: a sidebar on desktop and a tab bar
on phone to move between Today, Objectives, Deviations and the Parking lot, a page
header, and an account menu with the user's name, a Light / Dark switch and Sign out.
The whole app uses one set of Keel Modern tokens and fonts.

## How we know it worked

On the deployed service, a signed-in user on desktop and on phone moves between the
four places, switches the theme and signs out, all from the frame. The stop-gap on
Today is gone, and the app has one copy of the Keel Modern tokens, not two.

## Out of scope

The screens inside the frame — Today, Objectives, Deviations and the Parking lot are
each their own intent. The shared patterns those screens bring with them: dialogs,
toasts, keyboard shortcuts, pills, list and detail, notes. Onboarding.
