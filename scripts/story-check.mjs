#!/usr/bin/env node
/**
 * I-02's check against a running service, over HTTP: one run takes an
 * objective from created to completed, with effort, a deviation, a parked
 * idea and its reviews attached, and reads the whole story back — through
 * the API only. src/story.itest.ts is the same story in CI.
 *
 *   KEEL_SESSION=<keel_session cookie value> node scripts/story-check.mjs <base-url>
 *
 * The cookie is the signed-in user's: copy keel_session from the browser
 * after signing in. It is read from the environment, never an argument, so
 * it does not land in shell history.
 *
 * It WRITES to the record it runs against, and nothing is ever deleted
 * (NFR-01): an objective that started four weeks ago and ends today, with
 * today's effort, a note, two deviations, an approved idea and five reviews. Effort is logged
 * only for today (G21), so the past weeks have none. Against the deployed
 * service that is the real record — ask before running it there.
 *
 * Build/ops script: reads its own environment directly.
 */
const base = process.argv[2]?.replace(/\/$/, "");
const session = process.env.KEEL_SESSION?.trim();
if (!base || !session) {
  console.error(
    "usage: KEEL_SESSION=<cookie value> node scripts/story-check.mjs <base-url>",
  );
  process.exit(2);
}

const run = new Date().toISOString().slice(0, 19);
let step = 0;

// Every date is relative to today in UTC, the zone the story writes in.
const today = new Date().toISOString().slice(0, 10);
const daysFrom = (date, n) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
const start = daysFrom(today, -28); // 29 days: Week 1–4, then End of plan today

async function call(method, path, status, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      cookie: `keel_session=${session}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  if (res.status !== status) {
    throw new Error(
      `${method} ${path}: expected ${status}, got ${res.status}\n${text}`,
    );
  }
  return text ? JSON.parse(text) : undefined;
}

function check(what, ok) {
  step += 1;
  if (!ok) throw new Error(`step ${step} failed: ${what}`);
  console.log(`  ✓ ${what}`);
}

try {
  console.log(`story-check against ${base} (run ${run})`);

  const o = await call("POST", "/v1/objectives", 201, {
    title: `story-check ${run}`,
    why_now: "I-02's check: the whole story through the API.",
    success_criteria: "It reads back as it was written.",
    schedule: {
      mode: "fixed",
      planned_weekdays: [1, 2, 3, 4, 5, 6, 7],
      minutes_per_planned_day: 60,
    },
    starts_on: start,
    tz: "UTC",
    runs_for_days: 29,
    review_cadence: "weekly",
  });
  check("an objective is declared", o.status === "active");

  const entry = await call(
    "POST",
    `/v1/objectives/${o.id}/effort-entries`,
    201,
    {
      local_date: today,
      tz: "UTC",
      occurred_at_local: "09:00",
      minutes: 60,
      note: "story-check",
    },
  );
  check("effort is logged today", entry.local_date === today && !entry.extra);
  await call("POST", `/v1/objectives/${o.id}/effort-entries`, 422, {
    local_date: today,
    tz: "UTC",
    occurred_at_local: "09:30",
    minutes: 30,
    note: "story-check overlap",
  });
  await call("POST", `/v1/objectives/${o.id}/effort-entries`, 201, {
    local_date: today,
    tz: "UTC",
    occurred_at_local: "10:00",
    minutes: 30,
    note: "story-check",
  });
  check("an overlapping entry is refused; one after it is logged", true);

  const note = await call("POST", `/v1/objectives/${o.id}/notes`, 201, {
    written_on: today,
    text: "story-check note",
  });
  check("a note is added to the objective", note.text === "story-check note");
  await call("POST", `/v1/objectives/${o.id}/effort-entries`, 422, {
    local_date: daysFrom(today, -1),
    tz: "UTC",
    occurred_at_local: "09:00",
    minutes: 60,
    note: "story-check",
  });
  check("yesterday's effort is refused: a day's effort is fixed", true);

  const deviation = await call("POST", "/v1/deviations", 201, {
    objective_ids: [o.id],
    local_date: daysFrom(start, 2),
    tz: "UTC",
    kind: "chosen",
    what_happened: "story-check deviation",
    reasoning: "story-check",
    minutes: 120,
  });
  check("a chosen deviation names the objective", deviation.kind === "chosen");

  const drifted = await call("POST", "/v1/deviations", 201, {
    objective_ids: [o.id],
    local_date: daysFrom(start, 9),
    tz: "UTC",
    kind: "drifted",
    what_happened: "story-check drift",
    minutes: 30,
  });
  check(
    "a drifted deviation needs no reasoning",
    drifted.kind === "drifted" && !("reasoning" in drifted),
  );

  const idea = await call("POST", "/v1/parked-ideas", 201, {
    idea: `story-check idea ${run}`,
    why: "story-check",
    caught_on: daysFrom(start, 3),
  });
  check("an idea is parked", idea.verdict === "parked");

  const approved = await call(
    "POST",
    `/v1/parked-ideas/${idea.id}/verdicts`,
    201,
    { verdict: "approved", occurred_on: today },
  );
  check(
    "the idea is approved, dated today",
    approved.verdict === "approved" && approved.verdict_on === today,
  );

  const reviewIds = [];
  for (const label of ["Week 1", "Week 2", "Week 3", "Week 4"]) {
    const draft = await call("POST", `/v1/objectives/${o.id}/reviews`, 201);
    if (label === "Week 1") {
      await call(
        "PUT",
        `/v1/reviews/${draft.id}/deviation-verdicts/${deviation.id}`,
        200,
        { verdict: "worth_it" },
      );
    }
    await call("PATCH", `/v1/reviews/${draft.id}`, 200, {
      what_changes_next: `After ${label}.`,
      review_summary: `${label}, recorded.`,
      ...(label === "Week 2" ? { improvement_answer: "not_tried" } : {}),
    });
    if (label === "Week 2") {
      check(
        "Week 2 quotes Week 1's change back",
        draft.previous_what_changes_next === "After Week 1.",
      );
    }
    await call("POST", `/v1/reviews/${draft.id}/save`, 200);
    check(`${label} is reviewed and saved`, draft.label === label);
    reviewIds.push(draft.id);
  }

  // Read before completing: the completed event is dated today, the plan's
  // last day, which then stops being planned (TRIAGE).
  const running = await call("GET", `/v1/objectives/${o.id}`, 200);
  check(
    "today's 90 minutes read as 60 credited and 30 over plan",
    running.figures.logged_minutes === 90 &&
      running.figures.over_target_minutes === 30 &&
      running.figures.extra_off_day_minutes === 0,
  );
  check(
    "four empty weeks put it behind, by the plan so far",
    running.track === "behind" && running.weeks.length === 5,
  );
  const { entries } = await call(
    "GET",
    `/v1/objectives/${o.id}/effort-entries?from=${today}&to=${today}`,
    200,
  );
  check(
    "today's entries read back in time order",
    JSON.stringify(entries.map((e) => e.occurred_at_local)) ===
      JSON.stringify(["09:00", "10:00"]),
  );

  const planEnd = await call("POST", `/v1/objectives/${o.id}/reviews`, 201);
  await call("PATCH", `/v1/reviews/${planEnd.id}`, 200, {
    criteria_verdict: "partly_met",
    outcome: "completed",
    review_summary: "Done, mostly.",
  });
  await call("POST", `/v1/reviews/${planEnd.id}/save`, 200);
  check("the plan-end review completes it", planEnd.kind === "plan_end");

  const done = await call("GET", `/v1/objectives/${o.id}`, 200);
  check(
    "the objective reads back completed, verdict partly met, nothing due",
    done.status === "completed" &&
      done.criteria_verdict === "partly_met" &&
      done.reviews_due === 0,
  );
  check(
    "its history is created, then completed on the plan's last day",
    JSON.stringify(
      done.status_history.map((e) => [e.change, e.occurred_on]),
    ) ===
      JSON.stringify([
        ["created", start],
        ["completed", today],
      ]),
  );
  check(
    "it keeps its note",
    done.notes.length === 1 && done.notes[0].id === note.id,
  );

  const { reviews, due } = await call(
    "GET",
    `/v1/objectives/${o.id}/reviews`,
    200,
  );
  check("nothing is left due", due.length === 0);
  check(
    "five saved reviews read back in order",
    JSON.stringify(reviews.map((r) => r.label)) ===
      JSON.stringify(["Week 1", "Week 2", "Week 3", "Week 4", "End of plan"]) &&
      reviews.every((r) => r.status === "saved"),
  );

  const { deviations } = await call(
    "GET",
    `/v1/deviations?from=${start}&to=${today}&objective_id=${o.id}`,
    200,
  );
  const chosen = deviations.find((d) => d.id === deviation.id);
  check(
    "the chosen deviation reads back judged by Week 1",
    deviations.length === 2 &&
      chosen?.verdict === "worth_it" &&
      chosen?.verdict_review_id === reviewIds[0],
  );

  const { ideas } = await call("GET", "/v1/parked-ideas", 200);
  check(
    "the idea reads back approved in the parking lot",
    ideas.some((i) => i.id === idea.id && i.verdict === "approved"),
  );

  console.log(`\n✓ story-check passed: objective ${o.id}`);
} catch (e) {
  console.error(`\n✗ story-check failed: ${e.message}`);
  process.exit(1);
}
