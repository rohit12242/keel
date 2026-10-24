# Keel Modern — design handoff

The UI Keel is built to. It replaces the earlier screen designs (removed from this folder; the owner keeps a backup).

Everything here was reviewed and approved screen by screen in a clickable prototype. The prototype is the reference for look and behaviour; these documents are the reference for **rules, states and wording** — when the two disagree, say so in the intent rather than guessing.

## What is in this folder

| File | What it is |
|---|---|
| `keel-modern-prototype.html` | The clickable prototype, one self-contained file. Open it in a browser. The **Prototype** button (bottom right) jumps between screens, switches sample data (planned day, day off, new user), starts onboarding and resets. Its panel also lists the fake codes and emails the auth screens accept. Sample data lives in the browser's local storage. |
| `src/app/keel-modern-tokens.css` | Colour, type, spacing, radius, size and shadow tokens, light and dark. Moved into the app in I-05 so the design and the app share one copy. |
| `tokens.md` | The token set explained, the old-to-new name map, type and theming rules. |
| `contract-gaps.md` | **Read before building.** Where the design asks for something `docs/keel-api.yaml` or the domain rules do not provide yet. |
| `screens/01-shell.md` | App frame: sidebar, phone tab bar, headers, account menu, theme, dialogs, toasts, keyboard shortcuts, shared patterns. |
| `screens/02-auth-and-onboarding.md` | Keel's own sign-in, sign-up, email confirmation and two-step reset, and the three-step first run. |
| `screens/03-today.md` | Today. |
| `screens/04-objectives.md` | Objectives list and detail (Overview, Effort, Deviations, Reviews), New objective, pause, resume, terminate, notes. |
| `screens/05-reviews.md` | Weekly / monthly review, final review with Complete or Extend, saved review. |
| `screens/06-deviations.md` | Deviations screen and the Log a deviation dialog. |
| `screens/07-parking-lot.md` | Parking lot, Park an idea, verdicts, Drop. |

## Principles the screens share

1. **The record is honest and fixed.** Deviations, saved reviews and notes can't be edited or deleted. Effort entries are the one thing a user can edit or delete, and only from Today.
2. **One rule, one implementation.** Adherence, day states, review windows and the parking lock each have one domain function (`docs/domain/`). Every screen that shows them calls it; no screen computes its own.
3. **Colour never carries meaning alone (NFR-13).** Every coloured state also has a word: *Met*, *Short 20m*, *Missed*, *Off day*, *+ Extra*, *Chosen*, *Drifted*, *Locked*.
4. **One accent.** Violet (`--accent`) is the only accent: primary buttons, selection, focus, the current nav item. Green (`--effort`), red (`--deviation`) and amber (`--caution`) are meanings, never decoration.
5. **Numbers are mono.** Durations, dates in lists, counts and percentages use `--font-mono` with tabular figures.
6. **Durations** read `2h 00m` in totals and `45m` / `1h 40m` / `2h` in compact places. **Times** are 24-hour, `09:20 – 10:20`.
7. **Phone is first-class.** Every screen has a phone layout at ≤ 860 px: list → detail navigation, bottom tab bar, sheets for dialogs, inputs at 16 px so iOS does not zoom.

## Weeks and months *(I-09)*

Every week is Monday to Sunday and every month a calendar month: weekly and monthly reviews, an objective's weeks, Today's week. A first or last week of fewer than 4 days, or month of fewer than 15, joins its neighbour (`docs/domain/review-windows.md`). The prototype's sample weeks run Sunday to Saturday; the screen docs' examples follow the rule. v1 plans fixed objectives only; flexible returns in v2.

## Suggested build order

Each line is roughly one intent. Contract gaps that block a step are listed in `contract-gaps.md`.

1. Tokens and fonts (`src/app/keel-modern-tokens.css`, Geist + IBM Plex Mono + Spectral via `next/font`), app shell, theme switch.
2. New objective — the form, without the "Start from" card, which needs approved ideas.
3. Today, with Log time (create, edit, delete an entry); its empty card opens New objective.
4. Onboarding — reuses the New objective form, so a new account can start one.
5. Objectives list and detail — Overview and Effort tabs.
6. Deviations screen and Log a deviation; the Deviations tab on an objective.
7. Reviews — weekly and monthly, drafts, saved review.
8. Final review — Complete and Extend.
9. Pause, resume, terminate; notes.
10. Parking lot, and New objective's "Start from" card.

## Sample data in the prototype

The prototype's "today" is **Saturday 5 September 2026**. Its sample objectives, entries, reviews and ideas are invented to show states; don't copy them into seeds or tests as if they were requirements. The Parking lot screen uses **22 September** as its "today" so locked and open ideas both show — a known prototype shortcut, not a rule.
