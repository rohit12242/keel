import { randomUUID } from "node:crypto";
import { getPool, query } from "@/shared/db";
import type { Objective } from "@/shared/contract";
import { createObjective } from "@/modules/objectives/service";
import { insertEffortEntry, type EffortEntryRow } from "@/modules/effort/repo";
import { createParkedIdea } from "@/modules/parking/service";
import { startReview } from "@/modules/reviews/service";
import { createDeviation } from "@/modules/deviations/service";
import type { Deviation } from "@/shared/contract";
import type { EffortEntryWrite } from "@/shared/contract";
import { localDayOf } from "@/shared/time/localDay";
import { cookieFor } from "./session";

/**
 * Integration-test data. Every suite makes the users and objectives it needs
 * and owns them; nothing is shared and nothing sits at a fixed id. Each call
 * is a new user, so the four per-timezone runs share one database without
 * seeing each other's rows (every query filters by user, NFR-10), and nothing
 * has to be deleted between cases or runs.
 */
export type TestUser = { id: string; email: string; cookie: string };

export async function testUser(tz = "Asia/Kolkata"): Promise<TestUser> {
  const id = randomUUID();
  const email = `itest-${id}@keel.test`;
  await query(
    `INSERT INTO "user" (id, email, tz, idp_subject) VALUES ($1, $2, $3, $4)`,
    [id, email, tz, `itest|${id}`],
  );
  return { id, email, cookie: cookieFor(id, new Date(), email) };
}

/**
 * What the seed used to write: fixed Mon–Fri, 120 minutes a day, four weeks
 * from Monday 2026-09-14 to Sunday 2026-10-11, reviewed weekly. Any field
 * can be overridden.
 */
export const OBJECTIVE_BODY = {
  title: "itest objective",
  why_now: "A test needs one.",
  success_criteria: "The test passes.",
  schedule: {
    mode: "fixed",
    planned_weekdays: [1, 2, 3, 4, 5],
    minutes_per_planned_day: 120,
  },
  starts_on: "2026-09-14",
  tz: "Asia/Kolkata",
  runs_for_days: 28,
  review_cadence: "weekly",
} as const;

/**
 * An objective for `user`, written through the same use case the API calls,
 * so it obeys every rule a real one does and gets its `created` event.
 */
export async function testObjective(
  user: TestUser,
  over: Record<string, unknown> = {},
): Promise<Objective> {
  const result = await createObjective(
    user.id,
    { ...OBJECTIVE_BODY, ...over },
    new Date(),
  );
  if (!result.ok) {
    throw new Error(`testObjective: ${JSON.stringify(result)}`);
  }
  return result.objective;
}

/** Today in a zone, as the client would send it (NFR-12). */
export const todayIn = (tz: string): string => localDayOf(new Date(), tz);

/** `date` plus `n` days, as a local date. */
export const daysFrom = (date: string, n: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** The ISO weekday of a local date: 1 is Monday, 7 Sunday. */
export const isoWeekday = (date: string): number =>
  ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

/**
 * An objective whose plan covers today in Asia/Kolkata — a week behind, three
 * ahead — since effort is logged only for today (invariant 18). Every day is
 * planned, or, with `offToday`, every day but today's weekday.
 */
export async function testObjectiveToday(
  user: TestUser,
  opts: { offToday?: boolean } & Record<string, unknown> = {},
): Promise<Objective> {
  const { offToday, ...over } = opts;
  const today = todayIn(OBJECTIVE_BODY.tz);
  const weekdays = [1, 2, 3, 4, 5, 6, 7].filter(
    (d) => !offToday || d !== isoWeekday(today),
  );
  return testObjective(user, {
    starts_on: daysFrom(today, -7),
    runs_for_days: 28,
    schedule: {
      mode: "fixed",
      planned_weekdays: weekdays,
      minutes_per_planned_day: 60,
    },
    ...over,
  });
}

/** Append status events to an objective — setup only, until the API can. */
export async function addStatusEvents(
  objectiveId: string,
  events: readonly [occurredOn: string, change: string][],
): Promise<void> {
  for (const [occurredOn, change] of events) {
    await query(
      `INSERT INTO status_event (objective_id, occurred_on, change)
       VALUES ($1, $2, $3)`,
      [objectiveId, occurredOn, change],
    );
  }
}

/**
 * An effort entry on an objective, written straight through the repo — setup,
 * not a request. Since effort is logged only for today and entries never
 * overlap (invariant 18), the use case cannot seed history; the write rules
 * are tested through the routes instead. Starts at 09:00 unless told.
 */
export async function testEntry(
  objectiveId: string,
  over: Partial<EffortEntryWrite> = {},
): Promise<EffortEntryRow> {
  return insertEffortEntry(getPool(), objectiveId, {
    local_date: "2026-09-16",
    tz: "Asia/Kolkata",
    occurred_at_local: "09:00",
    minutes: 60,
    note: "itest entry",
    ...over,
  });
}

/**
 * A parked idea for `user`, caught on `caughtOn`. With no objective running
 * that day it is unlocked at once (docs/domain/parking-lock.md).
 */
export async function testIdea(
  user: TestUser,
  caughtOn = "2026-09-01",
): Promise<{ id: string; locked_until: string }> {
  const result = await createParkedIdea(
    user.id,
    { idea: "itest idea", why: "A test needs one.", caught_on: caughtOn },
    new Date(),
  );
  if (!result.ok) throw new Error(`testIdea: ${JSON.stringify(result)}`);
  return result.idea;
}

/**
 * A draft review of `user`'s objective — by default a fresh objective wholly
 * in the past, so its Week 1 (2026-09-14 … 2026-09-20) is the one due.
 */
export async function testReview(
  user: TestUser,
  objectiveId?: string,
  period?: { period_start: string; period_end: string },
): Promise<{ id: string; objective_id: string }> {
  const id = objectiveId ?? (await testObjective(user)).id;
  const result = await startReview(user.id, id, period, new Date());
  if (!result.ok) throw new Error(`testReview: ${JSON.stringify(result)}`);
  return { id: result.review.id, objective_id: id };
}

/** A deviation naming `objectiveIds`, through the real use case. Chosen, on Wednesday 2026-09-16. */
export async function testDeviation(
  user: TestUser,
  objectiveIds: string[],
  over: Record<string, unknown> = {},
): Promise<Deviation> {
  const result = await createDeviation(
    user.id,
    {
      objective_ids: objectiveIds,
      local_date: "2026-09-16",
      tz: "Asia/Kolkata",
      kind: "chosen",
      what_happened: "itest deviation",
      reasoning: "A test needs one.",
      minutes: 30,
      ...over,
    },
    new Date(),
  );
  if (!result.ok) throw new Error(`testDeviation: ${JSON.stringify(result)}`);
  return result.deviation;
}
