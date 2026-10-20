# App shell and shared patterns

## Layout

- **Desktop (> 860 px):** fixed sidebar `--size-sidebar` (240 px) on `--surface-side` with a hairline right border; content on `--bg`, padding 32 px top, 40 px sides.
- **Phone (≤ 860 px):** no sidebar. Header carries the page's primary action (small) and the avatar. A bottom **tab bar** (`--size-tabbar`) with Today · Objectives · Deviations · Parking lot. Content padding 16 px sides and enough bottom padding to clear the tab bar.
- Between 861 and 1180 px, two-column layouts drop to one column (the Today rail moves under the cards; list-and-detail screens narrow the list to 300–320 px).

## Sidebar

Top to bottom:
1. Wordmark: the Keel mark (stroke icon) and "Keel" in Spectral 600, 20 px.
2. Nav: Today · Objectives · Deviations · Parking lot. Each item is an icon plus a label. The current item is `--accent-text` on `--accent-tint`, weight 600, with `aria-current="page"`.
3. Pushed to the bottom:
   - **Theme**: label "Theme" with a two-option segmented control, **Light** (sun icon) and **Dark** (moon icon).
   - **User**: avatar (initial on `--accent-tint`), name, and a "Log out" link.

There is no plan-progress box and no Account page.

## Phone header and account menu

- The header's right side has the page's primary action (e.g. **+ Log time**, **+ New**, **Park an idea**) and a 44 px round avatar button (`aria-label="Account"`, `aria-expanded`).
- The avatar opens a menu: "Signed in as {name}", **Theme** (Light / Dark), **Sign out**. The menu stays open when the theme changes, so the change is visible. A click outside or Esc closes it.

## Page header

Eyebrow (e.g. "Saturday, 5 September", 13 px `--text-3`), title (32 px / 700), and primary action on the right. The desktop primary button shows its keyboard hint (`L`, `D`, `P`) in a small bordered key.

## Keyboard shortcuts

| Key | Does | Where |
|---|---|---|
| `L` | Log time | Today |
| `D` | Log a deviation | Today, Deviations, Parking lot |
| `P` | Park an idea | Today, Parking lot |
| `Esc` | Close the open dialog, menu or tooltip; cancel an inline note | Everywhere |
| `Enter` | Submit the dialog; save an inline note (`Shift+Enter` for a new line) | Dialogs, notes |
| `←` `→` | Move between objective tabs, and between radio options | Tabs, radio groups |

Shortcuts are ignored while typing in an input or textarea, and while a dialog is open.

## Dialogs

- Centred card, 520 px wide (640 px for the week dialogs), over `--scrim`. Title 20 px / 700, a close button (×) top right, a footer with the keyboard hint on the left (`esc to close`) and buttons on the right: muted **Cancel**, primary action.
- **Phone:** a bottom sheet — full width, top corners rounded 20 px, max height 92 vh, scrolls inside.
- Focus moves into the dialog on open and returns to the button that opened it on close; Tab is trapped inside.
- Validation: errors show under the field in `--deviation` with an icon, the field border turns `--deviation`, the dialog shakes once, and focus goes to the first bad field. An error clears as soon as the field is edited.
- Character counters (`0/120`, mono 11 px) sit at the right of the label; at the limit they turn `--caution`.

## Toasts

Bottom centre, `--text` background, `--on-text` text, 14 px. 2.8 s, or 5 s when it carries an **Undo**. Above the tab bar on phone. Used for confirmations only ("Note saved.", "Deviation recorded.", "Paused. The end date stays Mon 21 Sep."); never for errors a field can show.

## List and detail (Objectives, Deviations, Parking lot)

- **Desktop:** filter (segmented control with counts) above a two-column grid: list 340–380 px, detail card to the right. The selected row has an accent border and a 1 px accent ring.
- **Phone:** filters become a horizontally scrolling row of pills. The list fills the screen; tapping a row opens the detail full-screen with a **‹ Back** link (the header and filters hide). Rows show a chevron on phone only.
- A newly added row flashes `--accent-tint` once (respecting reduced motion).

## Pills

11–12 px / 600, `--radius-full`, colour pair from the table in `tokens.md`. Always text, never a colour dot alone.

## Notes (objectives and parked ideas)

Same pattern in both places:
- A "Notes" label, then the notes newest first (date in mono, then text, on `--surface-muted`), then **+ Add a note**.
- Add opens an inline box: a textarea (120 chars), the line "Once saved, a note can't be edited or deleted." with the counter, and **Cancel** / **Save note**. `Enter` saves, `Esc` cancels.
- No notes yet: "No notes yet."

## Motion

Small and quick: list rows and cards fade up 6–10 px over about 200–380 ms, dialogs scale from 0.98, the progress ring fills over 600 ms. All of it is off under `prefers-reduced-motion`.

## Accessibility checks that apply everywhere

Real buttons and links. 44 px touch targets on phone. Text contrast 4.5:1, including 11–12 px labels (the `--text-3` and `-text` tokens are chosen to pass). Charts carry an `aria-label` that reads out the values. Tabs use `role="tablist"` / `tab` / `tabpanel`.
