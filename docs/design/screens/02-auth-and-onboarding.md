# Sign-in, sign-up, reset and onboarding

## Auth screens (brief for Cognito managed login — see G1)

One layout for all three: a left hero on desktop ("The **evidence**, not guesswork, decides what you do next." with "evidence" highlighted, a one-line sub, and three dots: Effort against your plan · Deviations you declare · Ideas you parked) and a card on the right. On phone the hero collapses above the card. Footer line: "A private record of your time. Never shared."

| Screen | Fields and copy |
|---|---|
| **Sign in** | Title "Sign in", sub "Welcome back." Email; Password with **Show**; "Forgot password?" link by the password label. Button **Sign in**. "No account yet? Create one". |
| **Create account** | Name (placeholder "Joe"); Email; Password (7–12 characters, **Show**); checkbox "I understand that Keel records what I actually do, and that it only helps if the record is honest." Button **Create account**. "Already have an account? Sign in". |
| **Reset password** | "Enter the email you signed up with. We'll send you a reset link." Email. Button **Send reset link**. Note: "The link works once and expires after an hour." After sending: "**Check your inbox.** If {email} has an account, a reset link is on its way. It expires in an hour." and the button becomes **Send it again**. |

Errors (inline, under the field): "Enter the email on your account." · "Check the email: it needs an @ and a domain, like you@example.com." · "Enter your password." · "Enter your name. Only you will see it." · "Password is incorrect. Use 7-12 characters." · "Tick this to continue."

There is no in-app password change. A signed-in user who wants a new password signs out and uses "Forgot password?".

## Onboarding

Shown once, right after an account is created (G11). Full screen, no sidebar or tab bar. A top bar with the wordmark on the left and progress on the right: three 28 × 6 px bars (filled `--accent` up to the current step) and "Step n of 3".

### Step 1 — How Keel works

- Eyebrow "Welcome, {name}", title "How Keel works", lead: "Keel keeps an honest record of where your time goes, so each review runs on evidence instead of memory. Four things make up that record."
- Four cards, two by two (one column on phone), each with a tinted icon:
  - **Objectives**: "Something you're working toward, the days you'll give it, the time each day or week, and how long it runs."
  - **Effort**: "Log the time you actually spend, start to end, on Today. Keel measures it against the plan, day by day."
  - **Deviations**: "When time goes somewhere else, record it. *Chosen* you decided, with a reason. *Drifted* it happened to you." The two words are pills.
  - **Parking lot**: "Ideas that pull you away go here. They stay locked until the objectives you're running have ended."
- A violet strip: "**Then you review.** Every week or month you look at the numbers, judge the reasons you gave, and set one change to try next."
- Footer: "Skip, I'll explore on my own" (text button, left) and **Next: your first objective →** (right).
- Skip lands on an empty Today, whose empty card ("Add your first objective") opens New objective.

### Step 2 — Your first objective

- Title "Your first objective", lead "Pick one thing you want to work on now. You can add more objectives later."
- The **New objective form** (`04-objectives.md`), without the "Start from" card, because a new account has no approved ideas. Defaults: every day, 0 h 45 m, starts today, 4 weeks, review every week.
- Placeholders use a general example: "e.g. Conversational English" · "e.g. I want to speak up in English at work without rehearsing every sentence first." · "e.g. Hold a 15-minute conversation in English without switching to my first language."
- A tips column on the right (desktop only):
  - **Make it small enough to finish**: "One skill or one outcome. 'Learn English' is a goal; 'Conversational English' for four weeks is an objective."
  - **Plan the time you really have**: "Keel measures you against this every day. A plan you can keep beats an ambitious one you miss."
  - **Write success so you can see it**: "At the end you'll mark it Met, Partly met or Not met." With two examples: red "Hard to judge: 'Get better at English.'" and green "Easy to judge: 'A 15-minute conversation, no switching languages.'"
- Footer bar: **Back** (to step 1) and **Create objective**.

### Step 3 — You're set

- A green check, title "You're set.", lead "Your first objective starts today. Here is what it asks of you." (or "starts {Sun 6 Sep}.").
- **Your objective** card: name, schedule line (e.g. "Fixed · Every day · 45m a day · weekly reviews · Sat 5 Sep – Fri 2 Oct"), and three tiles: *Today* "Day 1 of 28" (or *Starts* "Sun 6 Sep"), *Planned today* "45m" (fixed; "Off day" if today isn't planned) or *Each week* "5h" (flexible), *First review* "Fri 11 Sep".
- **Each day, on Today**: three rows with tinted icons and their keyboard keys: *Log time* (L) "When a block ends, log its start, end and what you did." · *Log a deviation* (D) "When time goes elsewhere, say so: Chosen or Drifted." · *Park an idea* (P) "When a new idea pulls at you, park it and get back to work."
- **Go to Today →**.

### Phone

Same content in one column. The primary button is pinned to the bottom, full width, with Skip under it on step 1. The tips column is hidden; the success-criteria hint carries the hard/easy examples instead.
