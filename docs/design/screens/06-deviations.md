# Deviations

Data: `GET /deviations?from=…&to=…` (the current week), `POST /deviations`, `GET /deviation-patterns`, `POST /deviation-patterns`. A recorded deviation can't be edited or deleted; there are no endpoints for it, by design.

## Screen

- Header: eyebrow "This week · 31 Aug – 6 Sep" ("This week ·" hidden on phone), title "Deviations", **+ Log a deviation `D`**.
- **The screen lists only the current week.** Older deviations live on each objective's Deviations tab and in pattern counts.
- Bar under the header:
  - Filter **All · Chosen · Drifted**, with counts.
  - A week box: "Off plan this week **6h 15m** | Chosen 5h 00m | Drifted 1h 15m". On phone it becomes a 2 × 2 grid.
- List and detail (see `01-shell.md`).
- **Row:**
  - "Wed 2 Sep · Python and DSA" (mono date), kind pill.
  - What happened (bold, two lines max), duration ("5h 00m").
  - Newest first.
- **Detail:**
  - "Recorded 2 Sep" and the kind pill; what happened as the title (22 px).
  - Three fact tiles: **Time off plan** (mono, big) · **Pulled from** · **When** ("Wed 2 Sep"). The third tile is hidden on phone.
  - **Chosen:** "Your reasoning · recorded now, tested at review" in a caution-tint block.
  - **Drifted:** a red-tint pattern block with the pattern name, "3rd time" (counted across all time, the prior weeks included) and the pattern's description.
  - **What you did instead**, if given.
  - Footer **Verdict at review**:
    - Chosen: "Not reviewed yet. At the 21 Sep review you'll mark whether the reasoning held."
    - Drifted: "Not reviewed yet. It counts toward the pattern at the 21 Sep review."
    - Then "Recorded deviations can't be edited or deleted."
    - After review: show the verdict instead.
- **Empty week:**
  - "No deviations this week."
  - "When time goes somewhere other than the plan, record it. Recording it doesn't undo it. It makes it countable at review."
  - Two lines explaining **Chosen** and **Drifted**.
  - **Log a deviation**.
- Today's rail repeats the newest one as **Last deviation** with **Open in Deviations**.

## Log a deviation (dialog)

Fields in order:

| Field | Details |
|---|---|
| **Which kind** | Two choice cards. **Chosen**: "I decided to go off, with a reason. Something was urgent or genuinely worth it." **Drifted**: "It happened to me. I noticed afterwards." |
| **Pulled you away from** | Chips, one per active objective (its name, cut to fit; G43). Sent as `objective_ids: [id]`. |
| **What happened** | Textarea, 120, placeholder "One or two sentences, in your own words." |
| **Your reasoning** *(Chosen only)* | Textarea, 280, hint "Recorded now, tested at review. You'll mark whether it held." |
| **Pattern** *(Drifted only)* | A dropdown (listbox) of the user's patterns. Each option shows its name, description and a "3 before" count; **None of these** (a genuine one-off) last; then **+ Add a new pattern**. Hint "Pick the closest. Naming the pattern is how repeats become visible." |
| New pattern *(when chosen)* | **Name it** (40) and **What it looks like · optional** (120). Hint "It joins your pattern list when you record this deviation." |
| **What you did instead · optional** | Input, 120, placeholder "Helps when you read it back." |
| **Minutes** | Digits only: no decimals, no signs, max 4 characters. Placeholder "e.g. 90". |
| **When** | Seven weekday chips for the current week, **Mon … Sun**. Days after today are disabled ("Hasn't happened yet"). Defaults to today. |

Footer: "Once recorded, it can't be edited or deleted." with **Cancel** and **Record deviation**.

Errors:
- "Pick Chosen or Drifted."
- "Pick the objective it pulled you from."
- "Describe what happened. This is what you'll read back at review."
- "Write why it seemed worth it. You'll test it at review."
- "Pick the closest pattern, or None of these."
- "Name the pattern."
- "You already have a pattern with that name. Pick it from the list."
- "Enter the minutes."
- "That's more than a day. Use 1440 or less."
- "Pick the day it happened."

After recording:
- Go to Deviations (if not already there).
- Select the new deviation; its row flashes.
- Toast "Deviation recorded."

Seed patterns for a new account: New path looks better · Planning instead of doing · Research spiral · None of these. Each comes with a one-line description.
