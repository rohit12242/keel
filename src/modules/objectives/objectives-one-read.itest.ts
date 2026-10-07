import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPool, query } from "@/shared/db";
import {
  createObjective,
  getObjective,
  getObjectiveSchedule,
  listObjectives,
} from "./service";

/**
 * Neither read fans out per row (spec; NFR-03's reason applied to Keel's first
 * list). `query` is wrapped, and each read must make exactly one call however
 * many objectives exist — at least three here, so a per-objective query would
 * show up as three.
 */
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return { ...actual, query: vi.fn(actual.query) };
});

const BODY = {
  why_now: "Counting queries.",
  success_criteria: "One per read.",
  schedule: {
    mode: "fixed",
    planned_weekdays: [1, 3, 5],
    minutes_per_planned_day: 30,
  },
  starts_on: "2026-11-02",
  tz: "UTC",
  runs_for_days: 7,
  review_cadence: "weekly",
};

describe("each objectives read is one query (real Postgres)", () => {
  let id: string;

  beforeAll(async () => {
    for (const n of [1, 2, 3]) {
      const r = await createObjective({
        ...BODY,
        title: `itest: I-01 one read ${n}`,
      });
      if (!r.ok) throw new Error("fixture create failed");
      id = r.objective.id;
    }
    vi.mocked(query).mockClear();
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("lists every objective in one query", async () => {
    const r = await listObjectives(null);
    expect(r.ok && r.objectives.length).toBeGreaterThanOrEqual(3);
    expect(vi.mocked(query)).toHaveBeenCalledTimes(1);
  });

  it("opens one objective in one query", async () => {
    vi.mocked(query).mockClear();
    expect((await getObjective(id)).ok).toBe(true);
    expect(vi.mocked(query)).toHaveBeenCalledTimes(1);
  });

  it("computes the whole grid in one query", async () => {
    vi.mocked(query).mockClear();
    const r = await getObjectiveSchedule(id, null, null);
    expect(r.ok && r.grid.days.length).toBe(7);
    expect(vi.mocked(query)).toHaveBeenCalledTimes(1);
  });
});
