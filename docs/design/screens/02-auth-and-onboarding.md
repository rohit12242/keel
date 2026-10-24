# Sign-in, sign-up, reset and onboarding

## Auth screens (Keel's own, not Cognito managed login)

Keel shows its own sign-in, sign-up and reset screens. Cognito still holds the accounts and checks the password; the screens talk to it from the browser (SRP), so the password never reaches Keel's server. ADR-002 was revised for this in I-04.

One layout for all five: a left hero on desktop ("The **evidence**, not guesswork, decides what you do next." with "evidence" highlighted, a one-line sub, and three dots: Effort against your plan · Deviations you declare · Ideas you parked) and a card on the right. On phone the hero becomes a violet band above the form. Footer line: "A private record of your time. Never shared."

| Screen | Fields and copy |
|---|---|
| **Sign in** | Title "Sign in", sub "Welcome back." Email; Password with **Show**; "Forgot password?" link by the password label. Button **Sign in**. "No account yet? Create one". |
| **Create account** | Name (placeholder "Joe"); Email; Password (placeholder "At least 12 characters", **Show**) with a length counter and the hint "At least 12 characters. A short sentence you'll remember works well."; checkbox "I understand that Keel records what I actually do, and that it only helps if the record is honest." Button **Create account**. "Already have an account? Sign in". |
| **Check your email** | Mail icon, title "Check your email", "We sent a 6-digit code to **{email}**. Enter it to finish creating your account." Six code boxes. Hint "The code works for 24 hours. Pasting it works too." Button **Confirm email**, disabled until six digits are in. "Didn't get it? Check spam, or send a new code." and "Wrong email? Go back" (to Create account). |
| **Reset, step 1** | Eyebrow "Step 1 of 2", title "Reset your password", "Enter the email you signed up with. We'll send you a 6-digit code." Email. Button **Send code**. Note: "The code works once and expires after an hour." "Remembered it? Back to sign in". |
| **Reset, step 2** | Eyebrow "Step 2 of 2", title "Set a new password", "If **{email}** has an account, a 6-digit code is on its way. It expires in an hour." Code boxes with "Send a new code" by the label; New password with **Show** and the length counter. Button **Save password and sign in**. "Wrong email? Start again" (to step 1). |

### Behaviour

- **The code boxes are one input.** `inputmode="numeric"`, `autocomplete="one-time-code"`, six digits; anything else typed or pasted is dropped. The boxes only draw it: the next empty box has the focus ring and a caret. After a wrong code, the first keystroke replaces the whole code.
- **Length counter.** A bar and a count: empty "0 of 12"; short "9 of 12 · 3 more" (caution); long enough "✓ 20 characters" (effort, full bar). No upper limit and no character rules, matching the Cognito policy (minimum 12, nothing else).
- **Busy.** The button shows a spinner and "Signing in…", "Creating your account…", "Confirming…", "Sending…" or "Saving…", and the form's fields are disabled until the answer comes.
- **Send a new code** starts a 60-second wait: on Check your email the line becomes "New code sent. You can ask again in 0:59."; on reset step 2 the link becomes "new code in 0:59". A toast says "New code sent to {email}." and the code boxes empty.
- **Emails carry over.** "Forgot password?" and "reset your password" fill step 1 with the email already typed on Sign in; "Sign in instead" fills Sign in with the email from Create account.
- **After a reset, the user is signed straight in** and lands on Today with the toast "Password changed. You're signed in."
- **After confirming the email**, onboarding starts.

### Errors

Field errors sit under the field: "Enter the email on your account." · "Check the email: it needs an @ and a domain, like you@example.com." · "Enter your email, like you@example.com." · "Enter your password." · "Enter your name. Only you will see it." · "Enter a password of at least 12 characters." · "Use at least 12 characters. 3 more to go." · "Tick this to continue." · "Enter the 6-digit code from the email." · "Enter a new password of at least 12 characters."

Answers from Cognito:

| When | Where | Copy |
|---|---|---|
| Wrong email or password | Red banner above the fields; email kept, password emptied and focused | "**Email or password is incorrect.** Check both, or reset your password." It never says which one was wrong. |
| Too many attempts | Same banner | "**Too many attempts.** Wait a few minutes and try again." |
| Email already has an account | Under Email on Create account | "An account with this email already exists. Sign in instead." |
| Wrong code | Under the code boxes, which turn red; the hint hides | "That code is wrong. Check the latest email from Keel and try again." |
| Expired reset code | Amber banner on step 2; a new code is sent and the wait starts | "**That code has expired.** We've sent a new one. Use the newest email." |

Reset step 1 never says whether the email has an account; step 2's "If {email} has an account" covers both cases.

There is no in-app password change. A signed-in user who wants a new password signs out and uses "Forgot password?".

### In the prototype

Fakes stand in for Cognito, written in the **Prototype** panel: a password under 12 characters counts as wrong (the third in a row shows "Too many attempts"); any 6-digit code works except `000000` (wrong) and `999999` (expired, reset only); `taken@example.com` already has an account. These are prototype rules, not requirements.

## Onboarding

Shown once, right after the new account's email is confirmed (G11). Full screen, no sidebar or tab bar. A top bar with the wordmark on the left and progress on the right: three 28 × 6 px bars (filled `--accent` up to the current step) and "Step n of 3".

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
- **Your objective** card: name, schedule line (e.g. "Fixed · Every day · 45m a day · weekly reviews · Sat 5 Sep – Fri 2 Oct"), and three tiles: *Today* "Day 1 of 28" (or *Starts* "Sun 6 Sep"), *Planned today* "45m" (fixed; "Off day" if today isn't planned) or *Each week* "5h" (flexible), *First review* "Sun 13 Sep".
- **Each day, on Today**: three rows with tinted icons and their keyboard keys: *Log time* (L) "When a block ends, log its start, end and what you did." · *Log a deviation* (D) "When time goes elsewhere, say so: Chosen or Drifted." · *Park an idea* (P) "When a new idea pulls at you, park it and get back to work."
- **Go to Today →**.

### Phone

Same content in one column. The primary button is pinned to the bottom, full width, with Skip under it on step 1. The tips column is hidden; the success-criteria hint carries the hard/easy examples instead.
