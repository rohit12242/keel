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
import { testEntry, testUser, type TestUser } from "@/test/fixtures";

/**
 * I-01's check, as intent.md states it, through the real route handlers.
 *
 * Create a fixed objective (weekly reviews) and a flexible one (monthly).
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
  let flexible: Objective;

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
    flexible = await create({
      ...COMMON,
      title: "itest: I-01 flexible",
      schedule: {
        mode: "flexible",
        days_per_week: 3,
        minutes_per_planned_day: 60,
      },
      review_cadence: "monthly",
    });
  });

  afterAll(async () => {
    await getPool().end();
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
