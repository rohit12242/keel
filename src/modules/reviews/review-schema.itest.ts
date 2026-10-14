import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { getConfig } from "@/config/env";
import { getPool } from "@/shared/db";
import { testObjective, testUser } from "@/test/fixtures";

/**
 * I-02 step 21 — every constraint the reviews migration adds, proved by the
 * row it refuses. Each case writes in a transaction and rolls back.
 */
type PgError = { code?: string; constraint?: string };

let client: pg.Client;
let objectiveId: string;

async function attempt(
  statements: { sql: string; params: unknown[] }[],
): Promise<PgError | undefined> {
  await client.query("BEGIN");
  try {
    for (const s of statements) await client.query(s.sql, s.params);
    return undefined;
  } catch (e) {
    return e as PgError;
  } finally {
    await client.query("ROLLBACK");
  }
}

const review = (over: Record<string, unknown> = {}) => {
  const r = {
    kind: "weekly",
    period_start: "2026-09-14",
    period_end: "2026-09-20",
    status: "draft",
    saved_at: null,
    outcome: null,
    criteria_verdict: null,
    criteria_assessment: null,
    ...over,
  };
  return {
    sql: `INSERT INTO review
            (objective_id, kind, period_start, period_end, status, saved_at,
             outcome, criteria_verdict, criteria_assessment)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    params: [
      objectiveId,
      r.kind,
      r.period_start,
      r.period_end,
      r.status,
      r.saved_at,
      r.outcome,
      r.criteria_verdict,
      r.criteria_assessment,
    ],
  };
};

describe("review schema (real Postgres)", () => {
  beforeAll(async () => {
    objectiveId = (await testObjective(await testUser())).id;
    client = new pg.Client({ connectionString: getConfig().databaseUrl });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
    await getPool().end();
  });

  it("accepts a weekly draft and a saved plan-end review with its outcome", async () => {
    expect(
      await attempt([
        review(),
        review({
          kind: "plan_end",
          period_start: "2026-10-05",
          period_end: "2026-10-11",
          status: "saved",
          saved_at: new Date(),
          outcome: "completed",
          criteria_verdict: "met",
          criteria_assessment: "All three.",
        }),
      ]),
    ).toBeUndefined();
  });

  it("refuses a second review of the same period (invariant 14)", async () => {
    const err = await attempt([review(), review()]);
    expect(err?.constraint).toBe("review_one_per_period");
  });

  it.each([
    { outcome: "continued" },
    { criteria_verdict: "met" },
    { criteria_assessment: "Two of three." },
  ])(
    "refuses plan-end field %j on a weekly review (invariant 8)",
    async (over) => {
      const err = await attempt([review(over)]);
      expect(err?.constraint).toBe("review_plan_end_fields_only_on_plan_end");
    },
  );

  it("refuses a saved review with no saved_at, and a draft with one", async () => {
    for (const over of [
      { status: "saved" },
      { status: "draft", saved_at: new Date() },
    ]) {
      const err = await attempt([review(over)]);
      expect(err?.constraint).toBe("review_saved_at_when_saved");
    }
  });

  it("refuses a period that ends before it starts", async () => {
    const err = await attempt([
      review({ period_start: "2026-09-20", period_end: "2026-09-14" }),
    ]);
    expect(err?.constraint).toBe("review_period_in_order");
  });
});
