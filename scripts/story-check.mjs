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
 * (NFR-01): a back-dated objective (2026-09-14 … 2026-10-11) with its effort,
 * a deviation, an idea and four reviews. Against the deployed service that
 * is the real record — ask before running it there.
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
      planned_weekdays: [1, 2, 3, 4, 5],
      minutes_per_planned_day: 60,
    },
    starts_on: "2026-09-14",
    tz: "UTC",
    runs_for_days: 28,
    review_cadence: "weekly",
  });
  check("an objective is declared", o.status === "active");

  for (const [local_date, minutes] of [
    ["2026-09-14", 60],
    ["2026-09-15", 45],
    ["2026-09-22", 60],
    ["2026-09-26", 30],
    ["2026-10-05", 60],
  ]) {
    await call("POST", `/v1/objectives/${o.id}/effort-entries`, 201, {
      local_date,
      tz: "UTC",
      minutes,
      note: "story-check",
    });
  }
  check("effort is logged on five days", true);

  const deviation = await call("POST", "/v1/deviations", 201, {
    objective_ids: [o.id],
    local_date: "2026-09-16",
    tz: "UTC",
    kind: "chosen",
    what_happened: "story-check deviation",
    reasoning: "story-check",
    minutes: 120,
  });
  check("a chosen deviation names the objective", deviation.kind === "chosen");

  const idea = await call("POST", "/v1/parked-ideas", 201, {
    idea: `story-check idea ${run}`,
    why: "story-check",
    caught_on: "2026-09-17",
  });
  check("an idea is parked", idea.verdict === "parked");

  const reviewIds = [];
  for (const label of ["Week 1", "Week 2", "Week 3"]) {
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
    });
    await call("POST", `/v1/reviews/${draft.id}/save`, 200);
    check(`${label} is reviewed and saved`, draft.label === label);
    reviewIds.push(draft.id);
  }

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
        ["created", "2026-09-14"],
        ["completed", "2026-10-11"],
      ]),
  );
  check(
    "its figures are computed from the effort",
    done.figures.logged_minutes === 255 &&
      done.figures.extra_off_day_minutes === 30,
  );

  const { reviews } = await call("GET", `/v1/objectives/${o.id}/reviews`, 200);
  check(
    "four saved reviews read back in order",
    JSON.stringify(reviews.map((r) => r.label)) ===
      JSON.stringify(["Week 1", "Week 2", "Week 3", "End of plan"]) &&
      reviews.every((r) => r.status === "saved"),
  );

  const { deviations } = await call(
    "GET",
    `/v1/deviations?from=2026-09-14&to=2026-10-11&objective_id=${o.id}`,
    200,
  );
  check(
    "the deviation reads back judged by Week 1",
    deviations.length === 1 &&
      deviations[0].verdict === "worth_it" &&
      deviations[0].verdict_review_id === reviewIds[0],
  );

  const { ideas } = await call("GET", "/v1/parked-ideas", 200);
  check(
    "the idea reads back in the parking lot",
    ideas.some((i) => i.id === idea.id),
  );

  console.log(`\n✓ story-check passed: objective ${o.id}`);
} catch (e) {
  console.error(`\n✗ story-check failed: ${e.message}`);
  process.exit(1);
}
