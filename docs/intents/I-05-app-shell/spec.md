# Spec — I-05 · The app shell

**Intent:** `intent.md` in this folder · **Status:** Accepted · **Written:** 2026-10-22 · **Accepted:** 2026-10-22

The design this needs is in the repository: `docs/design/screens/01-shell.md` (the
frame), `docs/design/tokens.md` and `docs/design/keel-modern-tokens.css` (tokens, fonts,
theme). This file does not repeat them.

## What must be true

**One frame around every signed-in page**

- Today, Objectives, Deviations and the Parking lot each have a page, and each sits in
  the frame as designed: the sidebar above 860 px, the header and bottom tab bar at
  860 px and below.
- The current place is marked in the sidebar and the tab bar, for sight and for screen
  readers.
- Objectives, Deviations and the Parking lot show their page header and say plainly that
  the screen is not built yet. Each one's own intent fills it.
- Today keeps what it shows now, inside the frame. Its loading and error states sit in
  the frame too.
- A page header carries the eyebrow and the title. The primary action and its keyboard
  hint come with the screen that has one.

**Who is signed in, and signing out**

- The sidebar shows the avatar initial, the name and Log out. On phone, the avatar opens
  the account menu: "Signed in as {name}", Theme, Sign out.
- The name comes from the session, as on Today now — no database read.
- The menu closes on Esc or a click outside, and stays open while the theme changes.
- Signing out works from both places. If it fails, the person stays where they are and
  is told it did not work.
- Today's stop-gap "Signed in as" line and Sign out button are gone.
- Opening any signed-in page without a session goes to Sign in.

**The theme**

- Light and Dark, no System option. Until a choice is made, the device's preference
  decides. After that the choice holds in that browser, on every page, the sign-in
  screens included.
- No page is ever drawn in the other theme first, including the very first visit.

**One set of tokens**

- `keel-modern-tokens.css` is the app's only set of tokens. The old `tokens.css` is
  gone, and nothing reads an old token name.
- The sign-in screens use the same tokens as the rest of the app; their scoped copy is
  gone. This closes the TRIAGE entry "The Keel Modern tokens exist twice".
- Geist, IBM Plex Mono and Spectral are loaded once, for the whole app. Archivo is no
  longer loaded.

**What does not change**

- The sign-in screens look and behave as they do now, apart from following the chosen
  theme.
- The session, the API and the contract. No new runtime dependency: icons are inline
  SVG, as on the sign-in screens.
- Accessibility as `01-shell.md` sets it: real links and buttons, 44 px targets on
  phone, 4.5:1 text contrast in both themes.

## Out of scope

The screens inside the frame, including Today's redesign. Dialogs, toasts, keyboard
shortcuts, pills, list and detail, notes. Onboarding.
