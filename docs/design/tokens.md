# Tokens

`keel-modern-tokens.css` is the whole set. It replaces `src/app/tokens.css`; components read the variables from CSS Modules and never hard-code a hex value (the rule `tokens.css` already states).

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F5F5F3` | `#0E0F11` | Page ground |
| `--surface-side` | `#FAFAF9` | `#121316` | Sidebar |
| `--surface` | `#FFFFFF` | `#18191D` | Cards, dialogs, list rows |
| `--surface-row` | `#F7F7F5` | `#1E2024` | Entry rows, hovered rows, day blocks in dialogs |
| `--surface-muted` | `#EEEEEB` | `#222428` | Tiles, segmented-control track, quiet buttons, notes |
| `--line` | `#E6E6E2` | `#2A2C31` | Card borders, dividers |
| `--line-control` | `#868991` | `#6B6E76` | Input and chip borders (3:1 against surface) |
| `--track` | `#ECECE8` | `#2A2C31` | Empty part of bars and rings |
| `--text` | `#16171A` | `#EDEEF0` | Body text, figures |
| `--text-2` | `#53565E` | `#B0B3BA` | Secondary text |
| `--text-3` | `#686B73` | `#9A9DA4` | Labels, hints, dates |
| `--accent` | `#6F42F8` | `#9B80FF` | Primary buttons, selection, focus ring, progress |
| `--accent-text` | `#5A2FE0` | `#B4A0FF` | Links and accent text (passes 4.5:1) |
| `--accent-tint` | `#F0EBFF` | `#262040` | Selected chips and cards, due-review banner |
| `--on-accent` | `#FFFFFF` | `#0E0F11` | Text on `--accent` |
| `--kbd-line` | `rgba(255,255,255,.5)` | `rgba(14,15,17,.4)` | Keyboard hint border inside a primary button |
| `--on-text` | `#FFFFFF` | `#0E0F11` | Text on `--text` (toasts, tooltips) |
| `--effort` | `#2B7449` | `#5CCB93` | Effort logged, met, on track |
| `--effort-tint` | `#E6F3EB` | `#15291F` | Met pills, success criteria block |
| `--deviation` | `#B93A33` | `#F27D73` | Drifted, missed, behind, Terminate, errors |
| `--deviation-tint` | `#FBEBEA` | `#2F1A19` | Drifted pills, error fields |
| `--caution` | `#8A5D00` | `#E2B455` | Chosen, short, at risk, locked, drafts |
| `--caution-tint` | `#FBF1DD` | `#2E2510` | Chosen and locked pills, reasoning blocks |
| `--scrim` | `rgba(16,17,20,.32)` | `rgba(0,0,0,.6)` | Behind dialogs |

A short day's bar uses `--caution` at 60 % (`color-mix(in srgb, var(--caution) 60%, transparent)`) so it reads as "partly there" next to the solid `--effort` of a met day.

Status words by colour, so screens stay consistent:

| Meaning | Colour pair | Words used |
|---|---|---|
| Good / met / on track | `--effort` on `--effort-tint` | Met, On track, Completed, It held, Worked |
| Warning / partial / chosen | `--caution` on `--caution-tint` | Short, At risk, Chosen, Locked, Paused, Draft saved, Partly |
| Bad / missed / drifted | `--deviation` on `--deviation-tint` | Missed, Behind, Drifted, Dropped, Terminated, It didn't hold |
| Accent / next action | `--accent-text` on `--accent-tint` | Open · decide now, Review due, Active · Day 14 of 30, Final |
| Neutral | `--text-2` on `--surface-muted` | Taken, Off day, Not started, Nothing to check |

## Type

| Family | Token | Used for |
|---|---|---|
| Geist | `--font-sans` | Everything by default |
| IBM Plex Mono | `--font-mono` | Durations, times, dates in lists, counts, percentages, keyboard hints |
| Spectral 600 | `--font-brand` | The "Keel" wordmark only |

Load all three with `next/font` in the root layout (Archivo is no longer used). Tabular figures (`font-variant-numeric: tabular-nums`) on any column of numbers.

Sizes in use: page title 32 px / 700 / −0.025em (26–28 px on phone); detail title 24 px / 700; card heading 17–18 px / 700; body 15 px; secondary 13–14 px; labels and hints 12 px; pills 11–12 px / 600. Big figures (Today total) 40 px mono.

## Spacing, radius, size, border

All in `keel-modern-tokens.css` (`--space-2` … `--space-40`, `--radius-xs` … `--radius-full`, `--size-sidebar` 240 px, `--size-tabbar`, `--border-hairline`, `--border-selected`, `--border-focus`). Cards use `--radius-xl` (16 px) on desktop and `--radius-2xl` (18 px) on phone; inputs and buttons `--radius-lg` (10 px); pills `--radius-full`.

## Theme

Two choices, **Light** and **Dark** — no "System" option. On first visit use the device's `prefers-color-scheme` once, then store the choice (a cookie, so the server renders the right theme without a flash; local storage is fine until then). Apply it as `data-theme="light" | "dark"` on `<html>`.

## Old to new names

| Old (`src/app/tokens.css`) | New |
|---|---|
| `--color-paper` | `--bg` |
| `--color-surface` | `--surface` (cards) or `--surface-row` (rows) |
| `--color-surface-sunk` | `--surface-muted` |
| `--color-surface-hover` | `--surface-row` |
| `--color-ink` | `--text` |
| `--color-text-muted` | `--text-2` |
| `--color-text-faint` | `--text-3` |
| `--color-line` | `--line-control` (inputs) or `--line` (borders) |
| `--color-line-soft` | `--line` |
| `--color-line-strong` | `--line-control` |
| `--color-accent` | `--accent` |
| `--color-accent-strong` | `--accent-text` |
| `--color-positive` | `--effort` |
| `--color-deviation` | `--deviation` |
| `--font-serif` | `--font-brand` (wordmark only) |
| `--space-1 … --space-8` (rem) | `--space-4 … --space-32` (px names) |
| `--radius` | `--radius-lg` |

New with no old equivalent: `--caution` and its tint, every `-tint`, `--accent-text`, `--on-accent`, `--on-text`, `--track`, `--surface-side`, `--scrim`, the shadows.
