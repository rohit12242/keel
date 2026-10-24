import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool } from "@/shared/db";
import type {
  Objective,
  ObjectiveSummary,
  ScheduleGrid,
} from "@/shared/contract";
import * as objectives from "@/app/v1/objectives/route";
import * as one from "@/app/v1/objectives/[objectiveId]/route";
import * as schedule from "@/app/v1/objectives/[objectiveId]/schedule/route";
import {
  addStatusEvents,
  testEntry,
  testFlexibleObjective,
  testObjective,
  testUser,
  type TestUser,
} from "@/test/fixtures";

/**
 * I-01's check, as intent.md states it, through the real route handlers.
 *
 * Create a fixed objective (weekly reviews) and a flexible one (monthly) —
 * the flexible one written by its fixture, since v1 refuses it through the
 * API (I-09) while reads keep it.
 * The list returns both, active, with a schedule and 0 of a real target.
 * Opening one returns its plan and its history. Then effort is seeded on
 * planned days and an off day — past days cannot be logged through the route
 * (G21) — and the grid tells apart a day met, a day short, a planned day with
 * nothing on it, an off day, and an off day worked.
 *
 * Signed in as its own user, new on every run, so the four per-timezone runs
 * against one database never see each other's objectives, and nothing is
 * deleted (NFR-01).
 */
const BASE = "http://keel.test";
let me: TestUser;
const asMe = () => ({ cookie: me.cookie });
const params = (objectiveId: string) => ({
  params: Promise.resolve({ objectiveId }),
});

const COMMON = {
  why_now: "The record decides, so it has to exist.",
  success_criteria: "Both schedule modes read back correctly.",
  starts_on: "2026-11-02", // a Monday
  tz: "Asia/Kolkata",
  runs_for_days: 14,
};

async function create(body: Record<string, unknown>): Promise<Objective> {
  const res = await objectives.POST(
    new Request(`${BASE}/v1/objectives`, {
      method: "POST",
      headers: asMe(),
      body: JSON.stringify(body),
    }),
    undefined,
  );
  expect(res.status).toBe(201);
  return (await res.json()) as Objective;
}

async function logEffort(
  objectiveId: string,
  local_date: string,
  minutes: number,
  occurred_at_local = "09:00",
) {
  await testEntry(objectiveId, {
    local_date,
    tz: "Asia/Kolkata",
    occurred_at_local,
    minutes,
    note: "itest: I-01 check",
  });
}

async function grid(objectiveId: string): Promise<ScheduleGrid> {
  const res = await schedule.GET(
    new Request(`${BASE}/v1/objectives/${objectiveId}/schedule`, {
      headers: asMe(),
    }),
    params(objectiveId),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as ScheduleGrid;
}

const stateOn = (g: ScheduleGrid, date: string) =>
  g.days.find((d) => d.date === date)?.state;

describe("I-01 — declare an objective (the intent's check)", () => {
  let fixed: Objective;
  let flexible: { id: string };

  beforeAll(async () => {
    me = await testUser();
    fixed = await create({
      ...COMMON,
      title: "itest: I-01 fixed",
      schedule: {
        mode: "fixed",
        planned_weekdays: [1, 2, 3, 4, 5],
        minutes_per_planned_day: 60,
      },
      review_cadence: "weekly",
    });
    flexible = await testFlexibleObjective(
      me,
      { daysPerWeek: 3, minutes: 60 },
      { ...COMMON, title: "itest: I-01 flexible", review_cadence: "monthly" },
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("opens one with its plan weeks and their figures; the list carries none (G16)", async () => {
    const res = await one.GET(
      new Request(`${BASE}/v1/objectives/${fixed.id}`, { headers: asMe() }),
      params(fixed.id),
    );
    const opened = (await res.json()) as Objective;
    expect(opened.weeks.map((w) => [w.period_start, w.period_end])).toEqual([
      ["2026-11-02", "2026-11-08"],
      ["2026-11-09", "2026-11-15"],
    ]);
    expect(opened.weeks[0].figures).toMatchObject({ target_minutes: 300 });

    const listed = (await (
      await objectives.GET(
        new Request(`${BASE}/v1/objectives`, { headers: asMe() }),
        undefined,
      )
    ).json()) as { objectives: Record<string, unknown>[] };
    expect(listed.objectives.every((o) => !("weeks" in o))).toBe(true);
  });

  it("lists the plan so far, the band and the date the status began (G14, G15, G23)", async () => {
    // Its own user, so the two objectives above are not in this list.
    const other = await testUser();
    // Fixed Mon–Fri, 2 h a day, 2026-09-14 … 2026-10-11 — wholly past.
    const o = await testObjective(other);
    await testEntry(o.id, { local_date: "2026-09-14", minutes: 120 });
    await testEntry(o.id, { local_date: "2026-09-15", minutes: 120 });
    await addStatusEvents(o.id, [["2026-09-17", "paused"]]);

    const res = await objectives.GET(
      new Request(`${BASE}/v1/objectives`, {
        headers: { cookie: other.cookie },
      }),
      undefined,
    );
    const [listed] = ((await res.json()) as { objectives: ObjectiveSummary[] })
      .objectives;
    expect(listed).toMatchObject({
      status: "paused",
      status_since: "2026-09-17",
      // Planned Mon 14 – Wed 16 before the pause: 2 of 3 days met.
      figures_to_date: {
        target_minutes: 360,
        logged_minutes: 240,
        adherence_pct: 67,
      },
      track: "at_risk",
      upcoming_review_on: "2026-09-20",
    });
  });

  it("lists both, active, with the schedule given and 0 of a real target", async () => {
    const res = await objectives.GET(
      new Request(`${BASE}/v1/objectives`, { headers: asMe() }),
      undefined,
    );
    expect(res.status).toBe(200);
    const all = ((await res.json()) as { objectives: ObjectiveSummary[] })
      .objectives;
    const byId = (id: string) => all.find((o) => o.id === id);
    expect(all).toHaveLength(2);

    expect(byId(fixed.id)).toMatchObject({
      status: "active",
      schedule: {
        mode: "fixed",
        planned_weekdays: [1, 2, 3, 4, 5],
        label: "FIXED · MON–FRI · 1h 00m PER DAY",
      },
      start_date: "2026-11-02",
      end_date: "2026-11-15",
      figures: { adherence_pct: 0, logged_minutes: 0, target_minutes: 600 },
    });
    expect(byId(flexible.id)).toMatchObject({
      status: "active",
      schedule: {
        mode: "flexible",
        days_per_week: 3,
        label: "FLEXIBLE · 3 DAYS/WEEK · 1h 00m PER DAY",
      },
      figures: { adherence_pct: 0, logged_minutes: 0, target_minutes: 360 },
    });
    // Read against the real today, so only their presence is pinned here;
    // review-due.itest.ts pins the values against a plan wholly in the past.
    expect(byId(fixed.id)).toHaveProperty("next_review_on");
    expect(typeof byId(fixed.id)?.reviews_due).toBe("number");
  });

  it("opens one with its plan, its history and both review cadences", async () => {
    for (const [o, cadence] of [
      [fixed, "weekly"],
      [flexible, "monthly"],
    ] as const) {
      const res = await one.GET(
        new Request(`${BASE}/v1/objectives/${o.id}`, { headers: asMe() }),
        params(o.id),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as Objective;
      expect(body.review_cadence).toBe(cadence);
      expect(body.segments).toHaveLength(1);
      expect(body.segments[0]).toMatchObject({
        seq: 0,
        start_date: "2026-11-02",
        end_date: "2026-11-15",
      });
      expect(body.status_history).toEqual([
        { occurred_on: "2026-11-02", change: "created", reason: null },
      ]);
    }
  });

  it("reads the fixed schedule day by day, telling all five states apart", async () => {
    await logEffort(fixed.id, "2026-11-02", 60); // planned, met
    await logEffort(fixed.id, "2026-11-03", 30); // planned, short
    await logEffort(fixed.id, "2026-11-07", 45); // Saturday, an off day

    const g = await grid(fixed.id);
    expect(g.days).toHaveLength(14);
    expect(g.days.every((d) => d.segment_id === fixed.segments[0].id)).toBe(
      true,
    );
    expect(stateOn(g, "2026-11-02")).toBe("target_met");
    expect(stateOn(g, "2026-11-03")).toBe("worked_short");
    expect(stateOn(g, "2026-11-04")).toBe("planned_no_log");
    expect(stateOn(g, "2026-11-07")).toBe("off_day_worked");
    expect(stateOn(g, "2026-11-08")).toBe("off_day");

    const res = await one.GET(
      new Request(`${BASE}/v1/objectives/${fixed.id}`, { headers: asMe() }),
      params(fixed.id),
    );
    expect(((await res.json()) as Objective).figures).toMatchObject({
      logged_minutes: 135,
      target_minutes: 600,
      adherence_pct: 15,
      extra_off_day_minutes: 45,
    });
  });

  it("reads the flexible schedule as worked or not", async () => {
    // Afternoons: the fixed objective's entries hold the mornings, and no two
    // of a user's entries on one day overlap.
    await logEffort(flexible.id, "2026-11-02", 60, "13:00");
    await logEffort(flexible.id, "2026-11-03", 20, "13:00");

    const g = await grid(flexible.id);
    expect(stateOn(g, "2026-11-02")).toBe("target_met");
    expect(stateOn(g, "2026-11-03")).toBe("worked_short");
    expect(stateOn(g, "2026-11-04")).toBe("off_day");
    expect(g.days.some((d) => d.state === "planned_no_log")).toBe(false);
  });
});
