import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool } from "@/shared/db";
import type {
  Objective,
  ObjectiveSummary,
  ScheduleGrid,
} from "@/shared/contract";
import * as objectives from "@/app/objectives/route";
import * as one from "@/app/objectives/[objectiveId]/route";
import * as schedule from "@/app/objectives/[objectiveId]/schedule/route";
import * as effort from "@/app/objectives/[objectiveId]/effort-entries/route";

/**
 * I-01's check, as intent.md states it, through the real route handlers.
 *
 * Create a fixed objective (weekly reviews) and a flexible one (monthly).
 * The list returns both, active, with a schedule and 0 of a real target.
 * Opening one returns its plan and its history. Then effort is logged on
 * planned days and an off day, and the grid tells apart a day met, a day
 * short, a planned day with nothing on it, an off day, and an off day worked.
 *
 * Runs once per timezone against one database and deletes nothing (NFR-01),
 * so it only ever looks at the ids it created.
 */
const BASE = "http://keel.test";
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
    new Request(`${BASE}/objectives`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as Objective;
}

async function logEffort(
  objectiveId: string,
  local_date: string,
  minutes: number,
) {
  const res = await effort.POST(
    new Request(`${BASE}/objectives/${objectiveId}/effort-entries`, {
      method: "POST",
      body: JSON.stringify({
        local_date,
        tz: "Asia/Kolkata",
        minutes,
        note: "itest: I-01 check",
      }),
    }),
    params(objectiveId),
  );
  expect(res.status).toBe(201);
}

async function grid(objectiveId: string): Promise<ScheduleGrid> {
  const res = await schedule.GET(
    new Request(`${BASE}/objectives/${objectiveId}/schedule`),
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
    const res = await objectives.GET(new Request(`${BASE}/objectives`));
    expect(res.status).toBe(200);
    const all = ((await res.json()) as { objectives: ObjectiveSummary[] })
      .objectives;
    const byId = (id: string) => all.find((o) => o.id === id);

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
    // Omitted, not guessed: their rules are not in I-01.
    expect(byId(fixed.id)).not.toHaveProperty("next_review_on");
  });

  it("opens one with its plan, its history and both review cadences", async () => {
    for (const [o, cadence] of [
      [fixed, "weekly"],
      [flexible, "monthly"],
    ] as const) {
      const res = await one.GET(
        new Request(`${BASE}/objectives/${o.id}`),
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
      new Request(`${BASE}/objectives/${fixed.id}`),
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
    await logEffort(flexible.id, "2026-11-02", 60);
    await logEffort(flexible.id, "2026-11-03", 20);

    const g = await grid(flexible.id);
    expect(stateOn(g, "2026-11-02")).toBe("target_met");
    expect(stateOn(g, "2026-11-03")).toBe("worked_short");
    expect(stateOn(g, "2026-11-04")).toBe("off_day");
    expect(g.days.some((d) => d.state === "planned_no_log")).toBe(false);
  });
});
