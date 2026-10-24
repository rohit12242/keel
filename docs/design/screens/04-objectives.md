# Objectives

Data: `GET /objectives?status=…`, `GET /objectives/{id}` (whole-run figures), `GET /objectives/{id}/effort`, `GET /objectives/{id}/schedule`, `GET /objectives/{id}/reviews`, `GET /deviations`. Changes: `POST /objectives`, `POST /objectives/{id}/status-changes`, notes (G2).

## List

- Header "Objectives" with **+ New objective**.
- Filter: **Active · Paused · Completed · Terminated**, each with its count. There is no "All". Default Active.
- Row:
  - Line 1: name, plus a "1 review due" / "2 reviews due" pill (white with an accent outline) when reviews are waiting.
  - Line 2: the schedule ("Fixed · Mon–Sat · 2h a day" / "Flexible · 5 days a week · 20h a week").
  - Line 3: a thin accent progress bar for days elapsed of total.
  - Line 4: "Day 14 of 30" (mono) and a status pill.
- Status pill by state:

| State | Line 4 left | Pill |
|---|---|---|
| Active, running | Day 14 of 30 | `80% · On track` / `At risk` / `Behind` |
| Active, started today | Day 1 of 28 | `Day 1 · no score yet` |
| Active, starts later | Starts Sun 6 Sep | `Not started` |
| Active, plan ended, final review not saved | Ended Fri 4 Sep | `Plan ended · final review due` |
| Paused | Day 14 of 30 | `Paused` |
| Completed | Mar – Aug · 25 weeks | `Completed · 84%` |
| Terminated | Ended 5 Sep | `Terminated` |

- Nothing in a filter: "Nothing paused." (etc.).
- **No objectives at all:** an empty card, "No objectives yet." with three numbered steps (name it and say why; set days, time and length; review weekly or monthly, then decide at the end) and **+ New objective**.

## Detail

Head: name (24 px), a meta line "Fixed · Mon–Sat · 2h a day · weekly reviews · Sun 23 Aug – Mon 21 Sep", and a pill on the right: "Active · Day 14 of 30" / "Paused since 5 Sep" / "Completed · 84%" / "Terminated 5 Sep" / "Starts Sun 6 Sep".

Tabs: **Overview · Effort · Deviations n · Reviews n** (n = deviation count, saved reviews count). Arrow keys move between tabs.

### Overview

In order:
1. **Due review banner** (accent tint, whole banner is a button), shown when a review is due. Title: "Week 2 review is due" / "Final review is due". Sub: "1 review due · draft saved", or "· the plan ended Fri 4 Sep". Action **Start review** / **Continue draft**.
2. **State banner:**
   - **Paused** (caution tint): "Paused since Sat 5 Sep", the reason in quotes, "The end date stays Mon 21 Sep. Paused days are not planned and not made up." and **Resume**.
   - **Terminated** (red tint): "Terminated Sat 5 Sep" and the reason.
   - **Completed** (green tint): "Completed Sun 23 Aug at the final review" and **Open final review**.
3. **So far** (or **The whole plan** once ended), with "Sun 23 Aug – Sat 5 Sep · 14 of 30 days" on the right.
   - **Ring:** adherence %, coloured by status. There's no ring arc at 0 %.
   - **Logged effort:** "20h 40m", hint "of 24h 00m planned", plus "· +30m over" when any day went over.
   - **Targets met:** "8 of 12 planned days". Flexible objectives show **Weeks met** "1 of 2 full weeks at target", or "—" / "no full week yet".
   - **Deviation time:** "6h 15m", hint "2 deviations".
   - **Extra, off days:** "1h 30m", hint "1 off day". Flexible objectives show **Days worked** instead.
   - Before the first day has passed, these are replaced by: "It started today. Numbers appear once the first day has passed."
4. **Why it matters** (text) and **Success criteria · what would prove it worked** (green-tint block).
5. **Notes** (append-only; see `01-shell.md`).
6. **Status history**, newest first: a vertical timeline with the date (mono, "Sun 23 Aug"), a dot coloured by kind (created grey, active / resumed / extended violet, paused amber, terminated red, completed green), a bold label, and text.
   - Examples: "Started. Planned till Mon 21 Sep with weekly reviews." · "Fixed · Mon–Sat · 2h 00m a day · 30 days." · "Extended at the final review, now planned till Fri 25 Sep. Fixed · Mon, Tue, Thu, Fri · 1h 30m a day · weekly reviews." · a pause or terminate reason, word for word.
7. **Footer:**
   - **Active:** "Schedule and target are fixed. They change only when you extend at the final review." with **Pause** (secondary) and **Terminate** (red tint).
   - **Paused:** "Resume to plan days again. Terminating can't be undone." with **Terminate**.
   - **Completed or terminated:** "This status is final. You can keep adding notes."

### Effort tab

- **Last day**: "The last day you logged effort" — the latest date with entries, even if it's today ("Sat 5 Sep · today").
  - Card header: the day, "planned 2h 00m · 2 entries", a track bar against a black target tick, the logged figure, and a tag (✓ Met / ✓ Met · +30m over / − Short 20m / ✕ Missed / + Extra on an off day).
  - Flexible objectives show "flexible · about 4h a day" instead of a target.
  - Under it, the day's entries: "09:20 – 10:20 · note · 1h".
  - None yet: "Nothing logged yet."
- **By week**: "Open a week to see each day". Table columns: Week (a link, "Week 2 · Mon 31 Aug – Sun 6 Sep" + "so far") · Planned (Target for flexible) · Logged · Days met (Days worked) · **Over plan** ("+30m" / "0m") · Extra, off days ("—" for flexible).
- **Week dialog** (640 px): title "Week 2 · Mon 31 Aug – Sun 6 Sep", sub "Planned 12h 00m · logged 10h 25m · 3 of 6 met · +30m over plan".
  - Day chips: All days, Sun 30 … Sat 5.
  - One block per day: "Sat 5 Sep · planned 2h", total, tag, and the entries. "Nothing logged." when empty.
  - Future days aren't listed.

### Deviations tab

- Summary line: "2 deviations · **6h 15m** off plan · Chosen 5h 00m · Drifted 1h 15m".
- **Most recent**: a card with date, kind pill, what happened, "5h 00m · pattern name", and for Chosen the reasoning in a caution-tint block. Plus **Open in Deviations** when it's in the current week.
- **By week**: table with Week (a link when it has any) · Deviations · Chosen · Drifted ("—" when none).
- **Week dialog**: "Deviations · Week 2", sub "Sun 30 Aug – Sat 5 Sep · 1 deviation · 5h 00m off plan". Day chips, and a block per day listing each deviation (text, kind pill, duration · pattern, reasoning). "No deviations." when a day has none.
- None at all: "No deviations recorded against this objective."

### Reviews tab

See `05-reviews.md`.

## New objective (full page)

**‹ Objectives** back link, title "New objective". Cards:

1. **Start from:** two choice cards, **Scratch** ("A new objective, written from nothing.") and **An approved idea** ("2 ideas in the Parking lot are approved and waiting." / "None approved yet in the Parking lot.").
   - Choosing an idea shows a search box ("Search approved ideas", shown when there's more than one) and a scrolling list (max 300 px) of approved ideas: title, then "Caught 31 Aug · approved 22 Sep".
   - Picking one fills Name and Why (only if they're empty or still hold the previous idea's text).
   - Hint: "Picking one fills in the name and why. It moves to Taken when you create the objective."
   - No approved ideas: "No approved ideas yet. Approve one in the Parking lot, then come back." with a link.
2. **What it is:**
   - **Name** (80, placeholder "e.g. Conversational English").
   - **Why it matters** (280).
   - **Success criteria · what would prove it worked** (280), hint "You'll check this at the final review, so make it something you can see happen."
3. **Schedule:**
   - **v1 offers Fixed only** *(I-09)*: no choice cards; the card shows the weekday checkboxes and the daily target. The choice and the Flexible fields below come back in v2 (`docs/intents/TRIAGE.md`).
   - Choice cards: **Fixed · specific weekdays** ("The same days every week, with a daily target.") or **Flexible · days a week** ("Any days you choose, with a weekly target.").
   - Fixed: weekday checkboxes Mon … Sun, then **Daily target** "[ h ] h [ m ] m on each of those days".
   - Flexible: **Days a week** (1–7) and **Weekly target**, "across any 4 days".
     - The weekly target is split evenly across the days and rounded up to the minute, because the plan stores a target per day. The **Each week** tile shows the result: 2h 05m across 3 days is 42m a day, so "2h 06m".
4. **Plan:**
   - **Starts:** Today · Sat 5 Sep / Tomorrow · Sun 6 Sep / Next Monday · Mon 7 Sep.
   - **How long:** a number, then Weeks | Months, then "ends Sat 3 Oct". Plans may run into the next year; dates then show the year ("Tue 5 Jan 2027").
     - *n* months end the day before the same date *n* months on, with the month-end clamping of monthly reviews (`docs/domain/review-windows.md`): from Sat 5 Sep, 1 month ends Sun 4 Oct.
     - "A year or less" is up to 52 weeks or 12 months.
   - **Review every:** Week | Month.
   - Hint: "A review is due at the end of each week. The last one, on Sat 3 Oct, looks at the whole plan."
   - Three summary tiles: Planned days (fixed) or Days a week (flexible) · Each week · Reviews.
5. **Sticky footer bar:** "Schedule and target are fixed once created. They change only when you extend at the final review." with **Cancel** and **Create objective**.

Validation:
- "Pick an approved idea, or start from scratch."
- "Name the objective."
- "Say why it matters. You'll read it again at review."
- "Say what would prove it worked."
- "Pick at least one day."
- "Set a target above zero."
- "Set at least 15 minutes a day." (fixed) / "Set at least 45m a week, 15 minutes for each day." (flexible, with that week's figure)
- "Minutes go up to 59."
- "Keep a daily target under 16 hours." (fixed) / "Keep a weekly target under 48 hours, 16 for each day." (flexible, with that week's figure)
- "Enter how long it runs."
- "Keep it to a year or less."

Hours, minutes and length accept digits only.

On create, the objective:
- opens selected under Active,
- appears on Today (planned today, or "next on …"),
- moves the picked idea to Taken,
- shows a toast: "Objective created. It starts today." / "… starts Sun 6 Sep."

## Pause, resume, terminate

- **Pause** dialog: "Pause this objective?", "Days stop being planned until you resume. The end date stays Mon 21 Sep, so paused days are not made up. Reviews wait too."
  - Field **Why are you pausing?** (280, required), hint "It goes into the status history, word for word."
  - **Pause it**. The objective leaves Today and the list switches to Paused.
  - Toast "Paused. The end date stays Mon 21 Sep."
- **Resume** (no dialog): back to Active and back on Today, with history "Resumed. Still planned till Mon 21 Sep."
  - Toast "Resumed. It is back on Today."
- **Terminate** dialog: "Terminate this objective?", "It moves to Terminated and can't be resumed. Its effort, deviations, reviews and notes are kept."
  - Field **Why are you terminating it?** (required; error "Write why you are terminating it.").
  - Red **Terminate** button.
  - Toast "Terminated. Everything recorded is kept."
- An objective is never deleted.

## Phone

List → detail with **‹ Objectives**. The head stacks (pill under the title), tabs scroll sideways, tiles go two by two, the ring sits above the tiles, and the footer buttons fill the width. The week tables scroll inside their box.
