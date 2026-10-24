# Today

Data: `GET /day/{date}` (one round trip), `GET /deviations` for the last-deviation card. Entries: `POST /objectives/{id}/effort-entries`, `PATCH` / `DELETE /effort-entries/{id}`.

## Layout

Header: eyebrow with the full date ("Saturday, 5 September"), title "Today", **+ Log time `L`**.

Desktop is two columns: the main stack (summary, filter, objective cards) and a 320 px rail. Under 1180 px the rail moves below; on phone everything is one column.

## Summary card

- A progress ring (112 px; 76 px on phone) with the percentage of **today's planned time** logged: (planned − to go) ÷ planned, from the day's `today_planned_minutes` and `today_to_go_minutes`. Time on an objective not planned today is extra and never fills it, and time over one objective's plan never covers another's *(I-08)*.
- Big total "4h 40m" (mono 40 px), and the line "logged today · **1h 20m to go** of 6h planned". When everything planned is logged: "logged today · **plan met** for all 6h".
- Right side, desktop: **This week** "24h 20m" and **Extra, off days** "1h 30m". Phone shows "24h 20m this week" under the line instead.
- **Day off** (nothing planned today): no ring, a "Day off" pill, and "Nothing is planned today. Anything you log counts as extra." Once something is logged: "logged today · **all of it extra**, nothing was planned".

## Filter

"All" plus one option per objective, using each objective's name, cut to fit with an ellipsis and read in full by screen readers (segmented control on desktop, pills on phone). It hides the other cards; it doesn't change the summary.

## Objective cards

**Planned today** (grid of two on wide screens):
- A schedule pill ("Fixed · Mon–Sat") and a note on the right: "1h 20m to go", "Planned time met", or "Planned time met · +30m over".
- The objective name (20 px / 600).
- Figure "1h 40m / 2h 00m", with a progress bar.
- Entries, oldest first: "09:20–10:20 · Two-pointer problems — four solved · 1h". Each row is a button that opens **Edit entry**.
- No entries: a dashed box, "Nothing logged yet today."
- **+ Add entry** opens Log time with this objective chosen.

**Not planned today** (below, muted, full width): name, "Not planned today · next on Mon 7 Sep", plus "· 1h 20m extra today" when something was logged anyway. **Log anyway** button. Logged entries list under it.

An objective that starts later shows here with its start day as "next on". Paused, completed and terminated objectives don't appear on Today.

An objective whose plan has ended but whose final review isn't saved is still active, so it shows here too: name, "Plan ended Fri 4 Sep · final review due", and no **Log anyway**. The link to the review comes with Reviews *(G45)*. One with no planned day left before its plan ends reads "Not planned again · plan ends Wed 9 Sep".

Time can be logged only against an objective whose plan covers today. One that hasn't started yet, or whose plan has ended, has no **Log anyway** and no chip in Log time.

v1 plans fixed objectives only (I-09). The flexible card — "Flexible · 5 days a week", "15h 00m / 20h this week", "1 day left", and the hint "Leaves 5h 00m for the week" / "Meets the weekly target" — comes back in v2 (`docs/intents/TRIAGE.md`).

## Rail

1. **Adherence** card ("Plan to date"): one row per active objective with its name (cut to fit, as in the filter), a status pill (**On track** ≥ 80 %, **At risk** 60–79 %, **Behind** < 60 %) and the percentage, over a small bar in the matching colour. An objective that started today shows "Day 1" and no percentage; one that hasn't started shows "Not started".
2. **Log a deviation** (red tint) and **Park an idea** (muted), full width.
3. **Last deviation** card: kind pill, what happened, "4 Sep · 45m · Research spiral", **Open in Deviations**. Hidden when there are none.

## Log time / Edit entry dialog

| Part | Behaviour |
|---|---|
| Objective | Chips, one per objective whose plan covers today. Preselected when opened from a card. |
| When | **Start** and **End** (hh:mm, 24-hour, 84 px mono boxes), a **Now** button that fills End with the current time (and Start one hour earlier if empty), and the duration on the right ("1h 00m"). Typing accepts `920`, `0920`, `9:20`, `9.20`, `21`. |
| What did you do? | Textarea, 120 chars, required. |
| Hint line | Planned today: "Leaves 20m on today's plan" or "Meets today's plan". Not planned today: "Counts as extra, off-day time". |
| Buttons | **Cancel** and **Log 1h** (the label carries the duration; "Log time" until times are valid). Editing: title "Edit entry", button **Save**, plus **Delete entry** on the left in red. |

Errors: "Enter start and end in 24-hour time, like 09:20." · "End time must be after start time." · "Overlaps 09:20–10:20 (Two-pointer problems — four…). Change the times." · "Add a line about what you did."

After saving: the new row flashes, and a toast says "Logged 1h to Python and DSA." with **Undo**. Edit: "Entry updated." with Undo ("Change undone."). Delete: "Entry deleted." with Undo ("Entry restored.").

Entries can be edited or deleted **only from Today** and only for today (the contract refuses a changed `local_date`). The dialog sends `occurred_at_local` = start and `minutes` = end − start.

## Empty — new account

The summary, filter and rail are hidden. One card: icon, "Add your first objective", "An objective is something you're working toward and the time you plan to give it. Add one and Today will show your plan and what you've logged against it.", **+ Add objective** (opens New objective).

## Phone

Header: date, title, **+ Log time** (small) and the avatar. Cards are full width with 18 px radius; entry rows use a 92 px time column.
