import { randomUUID } from "node:crypto";
import { query } from "@/shared/db";
import type { Objective } from "@/shared/contract";
import { createObjective } from "@/modules/objectives/service";
import { createEffortEntry } from "@/modules/effort/service";
import type { EffortEntry } from "@/shared/contract";
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
  return { id, email, cookie: cookieFor(id) };
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
  const result = await createObjective(user.id, { ...OBJECTIVE_BODY, ...over });
  if (!result.ok) {
    throw new Error(`testObjective: ${JSON.stringify(result)}`);
  }
  return result.objective;
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

/** An effort entry on one of `user`'s objectives, through the real use case. */
export async function testEntry(
  user: TestUser,
  objectiveId: string,
  over: Record<string, unknown> = {},
): Promise<EffortEntry> {
  const result = await createEffortEntry(user.id, objectiveId, {
    local_date: "2026-09-16",
    tz: "Asia/Kolkata",
    minutes: 60,
    note: "itest entry",
    ...over,
  });
  if (!result.ok) throw new Error(`testEntry: ${JSON.stringify(result)}`);
  return result.entry;
}
