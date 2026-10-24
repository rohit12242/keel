# Reviews

Data: `GET /objectives/{id}/reviews`, `POST /objectives/{id}/reviews` (start or resume the due period), `GET /reviews/{id}` (figures recomputed), `PATCH /reviews/{id}` (draft), `POST /reviews/{id}/save`, `PUT /reviews/{id}/deviation-verdicts/{deviationId}`, `POST /objectives/{id}/extensions`. Periods come from `reviewWindows` (`docs/domain/review-windows.md`).

## Rules

- A period's review is **due** once its last day has arrived. The last period of a plan is the **Final review** (kind `plan_end`); it covers the whole plan and replaces that period's weekly review.
- **Oldest first.** When several are due, only the oldest can be opened; the others wait with "Opens after Week 1".
- A paused objective's reviews wait until it resumes.
- A review can be saved as a **draft** and continued later. A **saved** review is fixed for good: it can't be edited or deleted.
- Every number in a saved review is "as it was when saved".

## Reviews tab (on an objective)

- **Due**, hint "Reviews open oldest first". One card per due review:
  - Label ("Week 2 review" / "Final review"), "Draft saved" pill if any.
  - The period ("Sun 30 Aug – Sat 5 Sep", or "The whole plan · ended Fri 4 Sep") and "· last edited 5 Sep, 18:40".
  - **Start review** / **Continue draft** on the first card; the others are muted.
- Nothing due and nothing saved yet: "No reviews yet. The first one is due Sun 30 Aug."
- **Saved n**, hint "Newest first · kept exactly as written". A header row (Review · Adherence · Saved), then one row per review:
  - "Week 1 · Mon 24 – Sun 30 Aug" with "Change: 'Do the hardest problem first, before 10:00.'" under it (for a final review: "Final review · whole plan" + a **Final** pill, and "Outcome: completed").
  - A mini adherence bar with the %, the saved date (mono), and a chevron. The row opens the saved review.
- **Many reviews:**
  - More than 8 saved: group the rows under month headings (August, July …) and show the newest 8, then **Show 17 earlier reviews**.
  - No search, no type filter, no per-month summaries.
- Phone: the header row is hidden, the bar is hidden (only the %) and the date is hidden.

## Weekly or monthly review (full page)

Back link to the objective. Title "Week 2 review" (or "Month 1 review"), sub "Mon 31 Aug – Sun 6 Sep · Python and DSA for AI roles", pill "Draft saved · 5 Sep, 18:40" or "Due Sun 6 Sep".

Four numbered cards:

1. **The week in numbers**, hint "Week 1 for comparison".
   - Five tiles, each with last period's value as a hint ("90% in week 1"):
     - **Adherence**, coloured by status.
     - **Logged** "10h 25m", hint "of 12h 00m planned · +30m over".
     - **Targets met** "3 of 6" (flexible: Weeks met).
     - **Deviation time**.
     - **Extra, off days** (flexible: Days worked).
   - Then **day bars**, one column per day of the period (monthly periods show one row per week instead):
     - The value sits on top of each bar ("2h", "45m", "1h 40m", "0m"). A dashed line marks the daily target, labelled "2h" (flexible: "4h a day").
     - Bar styles: met = solid `--effort`; short = `--caution` at 60 %; missed = a 3 px red stub with a red "0m"; extra on an off day = white with a 2 px `--effort` outline; off day with nothing = "—".
     - Bars over target rise above the line (capped in height).
     - Under each bar: "Sun 30" and a word in colour — ✓ Met · ✓ +30m · − 1h 15m · ✕ Missed · + Extra · Off day · Later.
     - Compact: about 104 px high.
2. **Did last week's change work?**
   - The change set in the previous review, quoted, with "The change you set in the week 1 review".
   - **How did it go?** Worked · Partly · Didn't work · Didn't try it (G6).
   - First review: "First review of this objective, so there is no earlier change to check." with a "Nothing to check" pill.
3. **Chosen deviations**, hint "1 Chosen · 0 Drifted this week".
   - One block per Chosen deviation in the period: date · duration, a Chosen pill, what happened, the reasoning "recorded 2 Sep" in a caution-tint block.
   - **Did the reasoning hold?** It held · It didn't hold.
   - None: "No Chosen deviations this week." with "Nothing to judge".
4. **Reflect**: **What worked**, **What got in the way**, **What changes next week** (placeholder "One change you can try.", hint "One change. You'll check it at the next review."). 280 each with counters (G7).

**Sticky bar:** "A saved review can't be changed." with **Save draft** and **Save review**.

Validation, all at once, scrolling to the first error:
- "Say how last change went."
- "Mark whether the reasoning held."
- "Write what worked, even if it was small."
- "Write what got in the way."
- "Set one change to try next."

After saving:
- Back to the objective's Reviews tab, with toast "Week 2 review saved." (plus " 1 more due." when another review is waiting).
- **Save draft** stays on the page and shows "Draft saved. Continue it from Reviews."

## Final review (full page)

Title "Final review", sub "Mon 10 Aug – Fri 4 Sep · the whole plan · Portfolio site rebuild", pill "Due Fri 4 Sep". Five cards:

1. **The plan in numbers**, hint "All 26 days".
   - The same five tiles, whole plan, no comparison.
   - Then one adherence row per week: "Week 1" with a bar and "90%". A short last chunk is labelled by its days ("Mon 31–4").
2. **Last change and Chosen deviations**, hint "Same as a weekly review".
   - The previous change and How did it go? (as above).
   - Then "Chosen deviations in the last week" with the same blocks.
3. **Success criteria**:
   - The criteria quoted, "Set 9 Aug".
   - **Where you are:** Met · Partly met · Not met.
   - **What shows it** (280).
4. **Reflect**: What worked, What got in the way.
5. **What next**: two choice cards, **Complete it** ("It moves to Completed with this review.") and **Extend it** ("A later end date. Set the schedule for the extra time."). Choosing Extend reveals:
   - **Extend by:** number + Weeks | Months, with "Sat 5 – Fri 25 Sep · new end Fri 25 Sep".
   - **Schedule for the extension**, "Filled in from the current plan · change what should change":
     - Fixed weekdays | Flexible, days a week.
     - Weekday checkboxes with "Changed from Mon–Sat · 5 planned days a week", or Days a week.
     - **Target each planned day** / **Target each week** (h, m) with "was 2h 00m a day".
     - **Review every** Week | Month, "Then a final review at the new end".
     - **Reset to the current schedule**.
   - **Why extend** (280, required), placeholder "What would the extra time prove?".

The save button names the outcome: **Save review and complete** / **Save review and extend**. The bar text gains "The extension and its schedule go into the status history." when Extend is chosen.

Validation:
- "Pick where you are against the success criteria."
- "Write what shows it."
- "Pick Complete or Extend."
- "Enter how long to extend."
- "Keep an extension under six months."
- "Pick at least one day."
- "Set a target above zero."
- "Write why the extra time is worth it."

**Outcomes:**
- **Complete:** status → Completed. History gets "Completed at the final review. Success criteria: partly met." The objective leaves Today. Toast "Review saved. Portfolio site is completed."
- **Extend:** a new plan segment starts the day after the old end, using the new schedule and cadence. History gets "Extended at the final review, now planned till Fri 25 Sep. Fixed · Mon, Tue, Thu, Fri · 1h 30m a day · weekly reviews." The objective returns to Today. Toast "Review saved. Extended to Fri 25 Sep."

The schedule changes **only** here. Weekly reviews never change it.

## Saved review (full page, read only)

- Back link "‹ {objective} · Reviews". Title "Week 1 review", sub "Sun 23 – Sat 29 Aug · Python and DSA for AI roles · Fixed · Mon–Sat · 2h a day", and a pill "Saved Sun 30 Aug, 19:10".
- A grey lock note: "Kept exactly as written. A saved review can't be edited or deleted."
- **Previous / next** buttons for neighbouring saved reviews. Disabled ones explain why: "No earlier review", "Week 2 · still a draft", "Week 3 · not saved yet".
- Cards mirror the review:
  - **The week in numbers**: "As they were when saved", the same tiles and bars.
  - **Last week's change**: the quote and a pill with the answer, or "Nothing to check".
  - **Chosen deviations**: each with an "It held" / "It didn't hold" pill.
  - **Reflect**: the answers on `--surface-muted`. The next change is highlighted in an accent-tint block with "Checked in the week 2 review" or "To check in the week 2 review".
  - Final reviews also show **Success criteria** with its verdict pill, and **What next** ("Completed with this review", or "Extended to Fri 25 Sep" with the extension's schedule and why).

## Phone

Cards stack. Tiles go two by two; the bars compress (10–11 px labels). The sticky bar sits above the tab bar and drops its hint text.
