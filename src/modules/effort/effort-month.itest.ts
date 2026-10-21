import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPool, query } from "@/shared/db";
import * as route from "@/app/v1/objectives/[objectiveId]/effort/route";
import {
  testEntry,
  testObjective,
  testUser,
  type TestUser,
} from "@/test/fixtures";
import type { EffortMonth } from "./domain/effortMonth";

/**
 * I-02 step 10 — the Effort tab through its route: every declared response,
 * and one query however many entries there are (NFR-03). The objective is
 * fixed Mon–Fri, 2026-09-14 … 2026-10-11, all of it before today.
 */
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return { ...actual, query: vi.fn(actual.query) };
});

let me: TestUser;
let objectiveId: string;

const get = (id: string, qs: string) =>
  route.GET(
    new Request(`http://keel.test/v1/objectives/${id}/effort${qs}`, {
      headers: { cookie: me.cookie },
    }),
    { params: Promise.resolve({ objectiveId: id }) },
  );

describe("the Effort tab (real Postgres)", () => {
  beforeAll(async () => {
    me = await testUser();
    objectiveId = (await testObjective(me)).id;
    await testEntry(objectiveId, {
      local_date: "2026-09-14",
      minutes: 120,
    });
    await testEntry(objectiveId, { local_date: "2026-09-15", minutes: 30 });
    await testEntry(objectiveId, { local_date: "2026-09-15", minutes: 30 });
    await testEntry(objectiveId, { local_date: "2026-09-19", minutes: 45 });
    await testEntry(objectiveId, { local_date: "2026-10-01", minutes: 60 });
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("200s the month in Monday weeks, with missed planned days and vs target", async () => {
    vi.mocked(query).mockClear();
    const res = await get(objectiveId, "?month=2026-09");
    expect(res.status).toBe(200);
    expect(vi.mocked(query)).toHaveBeenCalledTimes(1);

    const m = (await res.json()) as EffortMonth;
    expect(m.month).toBe("2026-09");
    expect(m.weeks.map((w) => w.week_start)).toEqual([
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
    expect(
      m.weeks[0].days.map((d) => [d.date, d.minutes, d.vs_target]),
    ).toEqual([
      ["2026-09-14", 120, 0],
      ["2026-09-15", 30, -60],
      ["2026-09-15", 30, null],
      ["2026-09-16", null, -120],
      ["2026-09-17", null, -120],
      ["2026-09-18", null, -120],
      ["2026-09-19", 45, null],
    ]);
    expect(m.weeks[0]).toMatchObject({
      subtotal_minutes: 225,
      planned_days_worked: "2 of 5 planned days worked",
    });
    // Only Mon 28 to Wed 30 of the last week are in September.
    expect(m.weeks[2].planned_days_worked).toBe("0 of 3 planned days worked");
    expect(m.totals).toEqual({
      logged_minutes: 285,
      sessions: 5,
      longest_streak_days: 2,
      extra_off_day_minutes: 45,
    });
  });

  it("400s a missing or malformed month", async () => {
    for (const qs of ["", "?month=2026-9", "?month=2026-13"]) {
      expect((await get(objectiveId, qs)).status).toBe(400);
    }
  });

  it("404s an id that is not a UUID, or another user's objective", async () => {
    expect((await get("nope", "?month=2026-09")).status).toBe(404);
    const them = await testUser();
    const theirs = await testObjective(them);
    expect((await get(theirs.id, "?month=2026-09")).status).toBe(404);
  });
});
