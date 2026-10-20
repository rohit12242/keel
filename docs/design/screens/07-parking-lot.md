# Parking lot

Data: `GET /parked-ideas`, `POST /parked-ideas`, `POST /parked-ideas/{id}/verdicts`, notes (G3), Approved (G4). Lock rule: `docs/domain/parking-lock.md` — an idea is locked until the latest end date among the objectives that were active on the day it was caught.

## Screen

- Header "Parking lot" with **+ Park an idea `P`**. No counts line above the title.
- **No status filter.** All ideas, newest caught first.
- List and detail (see `01-shell.md`).
- **Row:** the idea (bold), "Caught 31 Aug" (mono), and a state pill:

| State | Row pill | Detail pill |
|---|---|---|
| Locked | `Locked · opens 2 Nov` with an ⓘ | the same; ⓘ is a button that shows the rule |
| Open | `Open · decide now` | `Open since 21 Sep · decide now` |
| Approved | `Approved 22 Sep` (`· early` if before it opened) | the same |
| Taken | `Taken 31 Aug · early` | the same |
| Dropped | `Dropped 21 Sep` | the same |

- **The lock rule is shown only through the ⓘ** on a locked pill. It's a tooltip: "Locked until 2 Nov, the latest end date among the objectives running on 14 Sep, the day you caught it (System design). Deciding earlier is recorded as early." Esc or a click elsewhere closes it. There's no separate "How the lock works" block.

## Detail

The layout starts with the idea; there's nothing above it except the back link on phone.

1. "Caught 31 Aug" and the state pill.
2. The idea as the title (24 px).
3. **Why it grabbed you**.
   - **Dropped:** two blocks side by side, **Why it grabbed you** and **Why it ended** (one column on phone).
4. **Approved:** a green-tint line, "Approved on 22 Sep. It moves to Taken when you pick it while creating an objective."
5. **Taken:** "Became an objective on 31 Aug, before it opened on 21 Sep. Runs 1 Sep – 2 Nov."
6. **Notes**: append-only, on every state including Dropped.
7. **Footer:**
   - **Parked or Approved:** **Your verdict**, a segmented control **Still parked · Approved · Dropped**.
     - Approved: toast "Approved. Pick it when you create an objective." with **Undo**.
     - Back to Still parked: "Back in Parked."
   - **Taken or Dropped:** "The verdict is final. You can keep adding notes."

**Taken can't be chosen here.** An idea becomes Taken only by being picked in New objective (from Approved).

## Park an idea (dialog)

- Title "Park an idea", sub "Write it down so you can stop thinking about it. You'll decide on it later."
- **The idea** (input, 120, "What's pulling at you?").
- **Why it grabbed you** (280), hint "Be honest. You'll read this again when you decide."
- A lock note in caution tint: "Locked until 2 Nov, the latest end date among the objectives running today (System design). Taking it or dropping it before then is recorded as early, not blocked." With nothing running (grey): "No objectives are running, so it opens straight away."
- Footer: "esc to close", **Cancel**, **Park it**.
- Errors: "Enter the idea." · "Add why it grabbed you."
- **After parking:**
  - **Always** go to the Parking lot with the new idea selected; its row flashes. There's no Undo.
  - Toast "Parked. Locked until 2 Nov." / "Parked."

## Drop this idea? (dialog)

- Title "Drop this idea?"
- A quote block with the idea and **Why it grabbed you**.
- One field, **Why** (placeholder "What changed since you parked it?"), required: "Write why you're dropping it."
- Red **Drop it** button.
- Toast "Dropped. Both reasons are kept." with **Undo**.

## Empty

- "Park the next idea that tries to pull you away."
- "Write down the idea and why it grabbed you. It stays locked until the objectives you're running now have ended, so you can get back to work without losing it."
- Three numbered steps:
  1. Park it: the idea and why it grabbed you.
  2. It opens on the latest end date among the objectives running that day.
  3. Then decide: take it as an objective, or drop it and say why.
- **Park an idea**.
