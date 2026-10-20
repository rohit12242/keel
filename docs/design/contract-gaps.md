# Where the design and the contract differ

Checked against `docs/keel-api.yaml`, `docs/domain/*.md` and ADR-002 on 20 Oct 2026. Each row needs a decision before the screen that uses it is built: change the contract, or change the design. **Blocking** means the screen can't be built as designed without it.

## Gaps

| # | Design asks for | Contract today | Suggested resolution | Blocking |
|---|---|---|---|---|
| G1 | **Sign-in, Create account and Reset password screens** in Keel's own look, with the honesty checkbox on Create account | Cognito managed login owns credentials, sign-up and reset (ADR-002). The app never renders a password field. | Treat the three auth screens as the **brief for Cognito managed-login branding**: logo, violet accent, Geist, the copy. The honesty checkbox can't live on Cognito's form; move that line to onboarding step 1 as a sentence, or drop it. | No |
| G2 | **Notes on objectives**: append-only list, each dated, 120 chars, can't be edited or deleted | No notes endpoint for objectives. | Add `GET/POST /objectives/{id}/notes` (append-only, no PATCH or DELETE). | Yes, for notes |
| G3 | **Notes on parked ideas**: the same append-only list, including on dropped ideas | One `note` per verdict row. | Add `POST /parked-ideas/{id}/notes` (append-only), or decide notes are verdict notes only and drop the list. | Yes, for notes |
| G4 | **Approved** verdict: an idea moves Parked → Approved; only approved ideas can be picked in New objective; picking one makes it Taken | Verdicts are `parked`, `dropped` (`taken` is written by creating an objective with `from_parked_idea_id`). No `approved`. | Add `approved` to the verdict enum, and have `POST /objectives` refuse a `from_parked_idea_id` that isn't approved. | Yes, for Parking lot |
| G5 | **Drifted deviations have no reasoning.** Chosen → "Your reasoning" (required). Drifted → a pattern instead. | `DeviationWrite.reasoning` is required for both kinds. | Make `reasoning` required only when `kind = chosen`. | Yes, for Log a deviation |
| G6 | **"Did last week's change work?"** has four answers: Worked · Partly · Didn't work · Didn't try it | `improvement_answer`: `yes`, `partly`, `no`. | Add `not_tried`. "Didn't try it" is a different finding from "didn't work" and the next review should be able to tell them apart. | No (can ship with three) |
| G7 | **Reflect** has three fields: *What worked* · *What got in the way* · *What changes next week* (the one quoted back next review) | `what_went_right`, `what_needs_improvement`, `review_summary`; `previous_improvement_note` is quoted back. | Map *What worked* → `what_went_right`, *What changes next week* → `what_needs_improvement` (so it is what gets quoted), and add `what_got_in_the_way`. Using `review_summary` for it would work but misnames the field. | Yes, for reviews |
| G8 | **Over plan**: a planned day can be logged above target ("✓ Met · +30m over"); weeks and totals show "+1h 30m over plan" | `figures` caps a day at its target and returns no over-target minutes. Day states have no over-target state (correctly: it's still `target_met`). | Add `over_target_minutes` to `figures` (same pass, same rule) so every screen gets the same number. Adherence stays capped. | No (the bars can derive it from `minutes_per_day`) |
| G9 | **Final review outcomes** are *Complete it* or *Extend it* only | `outcome` allows `continued`, `completed`, `paused`, `ended`. | Keep the contract. The design deliberately offers two; send `completed`, or `continued` followed by `POST /objectives/{id}/extensions`. | No |
| G10 | **Save draft** button with "Draft saved · 5 Sep, 18:40" | `PATCH /reviews/{id}` is described as autosave. | Do both: autosave on change, keep the button as an explicit save, show the last-saved time. | No |
| G11 | **Onboarding** shows once, after an account is created | No user flag for "has onboarded". | Show it on the first sign-in callback when the user has **zero objectives** and hasn't skipped; remember a skip in a cookie. No contract change needed until it must follow the user across devices. | No |
| G12 | **Pause** needs a reason ("Why are you pausing?") | `reason` is optional on status changes. | The UI requires it; the contract may stay optional. Same for Terminate (`end`). | No |
| G13 | **Undo** in the toast after Approve and Drop | Verdicts are append-only, and Dropped is final (decided in I-03). Nothing can be taken back once sent. | The UI holds the verdict request until the toast closes; Undo cancels it before it is sent. No backend change. *(Decided in I-03.)* | No |

## Decided in I-03

The table above is the gap as the design found it. This is how each was closed
(`docs/intents/I-03-backend-for-keel-modern/`).

| # | Decision |
|---|---|
| G1 | Out of I-03 — branding Cognito's managed login is not backend work. |
| G2 | `POST /objectives/{objectiveId}/notes`; notes return inside the objective. Append-only, open in every state. |
| G3 | `POST /parked-ideas/{ideaId}/notes`; notes return on every idea. A note is separate from the drop reason, which stays on the `dropped` verdict and is now required. |
| G4 | `approved` verdict; only an approved idea can be taken. **Also changed:** the lock no longer refuses any decision — approving, dropping or taking early is recorded as early (`decided_early`) — and dropped and taken are final. |
| G5 | `reasoning` required only for a `chosen` deviation (`422` otherwise). |
| G6 | `improvement_answer` gains `not_tried`. |
| G7 | Fields renamed for what they hold: `what_worked`, `what_got_in_the_way`, `what_changes_next` (quoted back as `previous_what_changes_next`). `review_summary` stays. |
| G8 | `figures.over_target_minutes`; adherence stays capped (`docs/domain/adherence.md`, rule 7). |
| G9 | Kept: the UI sends `completed`, or `continued` then an extension. |
| G10 | `last_saved_at` on the review and in the reviews list. Autosave and the Save draft button both write the draft. |
| G11 | Kept: no backend change. |
| G12 | Kept: the UI requires the reason; the contract leaves it optional. |
| G13 | Kept: the UI holds a verdict until its toast closes. |

## Names that differ (not gaps — map them in the UI)

| Design says | Contract value |
|---|---|
| Terminated | objective status `ended`, status change `end` |
| Met · Short · Missed · Off day · + Extra | day states `target_met` · `worked_short` · `planned_no_log` · `off_day` · `off_day_worked` |
| It held · It didn't hold | deviation verdict `worth_it` · `not_worth_it` |
| Weekly · Monthly · Final review | review kind `weekly` · `monthly` · `plan_end` |
| Fixed · Flexible | schedule mode `fixed` · `flexible` |
| Met · Partly met · Not met | `criteria_verdict` `met` · `partly_met` · `not_met` |
| Extend by *n* weeks / months | `extend_by_days`: weeks × 7; months = days to the same date *n* months on, minus one |
| An entry's start and end time | `occurred_at_local` (start) and `minutes` (end − start). The dialog collects start and end and sends both derived values. |

## Limits the design uses (stricter than the contract)

| Field | Design | Contract |
|---|---|---|
| Effort entry note | 120 | 2000 |
| Deviation *What happened* | 120 | 2000 |
| Deviation reasoning | 280 | 2000 |
| Pattern name / description | 40 / 120 | — |
| Idea / Why it grabbed you | 120 / 280 | — |
| Objective name | 80 | — |
| Why it matters · Success criteria | 280 each | — |
| Review answers | 280 each | 4000 |
| Notes | 120 | — |
| Pause / terminate reason | 280 | 2000 |

Short limits are part of the design: the point is a line someone will read back, not an essay. Enforce them in the UI and keep the contract's larger limits as the outer bound.
