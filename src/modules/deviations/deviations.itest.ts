import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import * as route from "@/app/v1/deviations/route";
import * as patterns from "@/app/v1/deviation-patterns/route";
import {
  addStatusEvents,
  testObjective,
  testUser,
  type TestUser,
} from "@/test/fixtures";
import { insertDeviation } from "./repo";
import type { DeviationWrite } from "./domain/deviationWrite";

/**
 * I-02 step 15 — recording and listing deviations through the routes. The
 * caller's objectives are fixed Mon–Fri, 2026-09-14 … 2026-10-11 (all past).
 */
let me: TestUser;
let a: string;
let b: string;

const body = (over: Record<string, unknown> = {}) => ({
  objective_ids: [a],
  local_date: "2026-09-16",
  tz: "Asia/Kolkata",
  kind: "chosen",
  what_happened: "Helped a friend move.",
  reasoning: "It mattered more today.",
  minutes: 90,
  ...over,
});

const post = (b: unknown) =>
  route.POST(
    new Request("http://keel.test/v1/deviations", {
      method: "POST",
      headers: { cookie: me.cookie },
      body: typeof b === "string" ? b : JSON.stringify(b),
    }),
    undefined,
  );

const get = (qs: string) =>
  route.GET(
    new Request(`http://keel.test/v1/deviations${qs}`, {
      headers: { cookie: me.cookie },
    }),
    undefined,
  );

type Listed = {
  deviations: { id: string; local_date: string; objective_ids: string[] }[];
  cost: Record<string, { count: number; minutes: number }>;
};

describe("deviations (real Postgres)", () => {
  beforeAll(async () => {
    me = await testUser();
    a = (await testObjective(me, { title: "A" })).id;
    b = (await testObjective(me, { title: "B" })).id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("201s a deviation naming two objectives, shaped as the contract says", async () => {
    const res = await post(
      body({ objective_ids: [a, b], did_instead: "Packed." }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      objective_ids: [a, b].sort(),
      local_date: "2026-09-16",
      kind: "chosen",
      did_instead: "Packed.",
      minutes: 90,
      pattern_id: null,
      pattern_name: null,
      verdict: null,
      verdict_review_id: null,
      pattern_nth: null,
      // Both objectives start Mon 14 Sep with weekly reviews: Week 1 holds it.
      review_due_on: "2026-09-20",
    });
  });

  it("422s an objective that is not the caller's, writing nothing", async () => {
    const theirs = await testObjective(await testUser());
    const before = await query(`SELECT 1 FROM deviation WHERE user_id = $1`, [
      me.id,
    ]);
    expect((await post(body({ objective_ids: [a, theirs.id] }))).status).toBe(
      422,
    );
    const after = await query(`SELECT 1 FROM deviation WHERE user_id = $1`, [
      me.id,
    ]);
    expect(after.rowCount).toBe(before.rowCount);
  });

  it("422s an objective that is not active, or a date outside its plan or after today", async () => {
    const ended = await testObjective(me);
    await addStatusEvents(ended.id, [["2026-09-15", "ended"]]);
    expect((await post(body({ objective_ids: [ended.id] }))).status).toBe(422);
    expect((await post(body({ local_date: "2026-09-13" }))).status).toBe(422);
    expect((await post(body({ local_date: "2099-01-01" }))).status).toBe(422);
  });

  it("422s a pattern that is not the caller's; counts one that is", async () => {
    const someone = await testUser();
    const theirPattern = (await (
      await patterns.POST(
        new Request("http://keel.test/v1/deviation-patterns", {
          method: "POST",
          headers: { cookie: someone.cookie },
          body: JSON.stringify({ name: "Theirs" }),
        }),
        undefined,
      )
    ).json()) as { id: string };
    expect((await post(body({ pattern_id: theirPattern.id }))).status).toBe(
      422,
    );

    const mine = (await (
      await patterns.POST(
        new Request("http://keel.test/v1/deviation-patterns", {
          method: "POST",
          headers: { cookie: me.cookie },
          body: JSON.stringify({ name: "Saying yes" }),
        }),
        undefined,
      )
    ).json()) as { id: string };
    const res = await post(body({ pattern_id: mine.id }));
    expect(await res.json()).toMatchObject({ pattern_name: "Saying yes" });
    const listed = (await (
      await patterns.GET(
        new Request("http://keel.test/v1/deviation-patterns", {
          headers: { cookie: me.cookie },
        }),
        undefined,
      )
    ).json()) as { patterns: { id: string; occurrences: number }[] };
    expect(listed.patterns.find((p) => p.id === mine.id)?.occurrences).toBe(1);
  });

  it("201s a drifted deviation with no reasoning, and says none", async () => {
    // JSON drops an undefined field, so the body carries no reasoning.
    const res = await post(body({ kind: "drifted", reasoning: undefined }));
    expect(res.status).toBe(201);
    const made = (await res.json()) as Record<string, unknown>;
    expect(made.kind).toBe("drifted");
    expect("reasoning" in made).toBe(false);
  });

  it("422s a chosen deviation without its reasoning, writing nothing", async () => {
    const chosen = body({
      what_happened: "no reason given",
      reasoning: undefined,
    });
    expect((await post(chosen)).status).toBe(422);
    const left = await query(
      `SELECT 1 FROM deviation WHERE user_id = $1 AND what_happened = $2`,
      [me.id, "no reason given"],
    );
    expect(left.rowCount).toBe(0);
  });

  it("numbers each deviation's place in its pattern, by date, for good", async () => {
    const pattern = (await (
      await patterns.POST(
        new Request("http://keel.test/v1/deviation-patterns", {
          method: "POST",
          headers: { cookie: me.cookie },
          body: JSON.stringify({ name: "Research spiral" }),
        }),
        undefined,
      )
    ).json()) as { id: string };
    const record = async (local_date: string) =>
      (await (
        await post(body({ pattern_id: pattern.id, local_date }))
      ).json()) as { id: string; pattern_nth: number };

    const first = await record("2026-09-15");
    const third = await record("2026-09-18");
    expect([first.pattern_nth, third.pattern_nth]).toEqual([1, 2]);
    // Recorded last but dated between: it is the 2nd, and the 18th's is now 3rd.
    const second = await record("2026-09-16");
    expect(second.pattern_nth).toBe(2);

    const listed = (await (
      await get(`?from=2026-09-14&to=2026-09-20&objective_id=${a}`)
    ).json()) as { deviations: { id: string; pattern_nth: number | null }[] };
    const nth = (id: string) =>
      listed.deviations.find((d) => d.id === id)?.pattern_nth;
    expect([nth(first.id), nth(second.id), nth(third.id)]).toEqual([1, 2, 3]);
  });

  it("400s a body that is not JSON or not a deviation", async () => {
    expect((await post("{nope")).status).toBe(400);
    expect((await post(body({ objective_ids: [] }))).status).toBe(400);
  });

  it("writes the deviation and its objectives together, or neither", async () => {
    // Past the service's checks, straight at the write: the second objective
    // is someone else's, so the schema refuses its row — and the deviation
    // written a statement earlier must go with it.
    const theirs = await testObjective(await testUser());
    const write: DeviationWrite = {
      ...(body() as Omit<DeviationWrite, "did_instead" | "pattern_id">),
      objective_ids: [a, theirs.id],
      what_happened: "all-or-nothing probe",
      did_instead: null,
      pattern_id: null,
    };
    await expect(insertDeviation(me.id, write)).rejects.toMatchObject({
      code: "23503",
    });
    const left = await query(
      `SELECT 1 FROM deviation WHERE user_id = $1 AND what_happened = $2`,
      [me.id, "all-or-nothing probe"],
    );
    expect(left.rowCount).toBe(0);
  });

  it("lists a range newest first, filters by objective, and costs by kind", async () => {
    // A fresh user, so the range holds only what this case writes.
    me = await testUser();
    const x = (await testObjective(me)).id;
    const y = (await testObjective(me)).id;
    await post(
      body({ objective_ids: [x], local_date: "2026-09-15", minutes: 30 }),
    );
    await post(
      body({
        objective_ids: [x, y],
        local_date: "2026-09-17",
        kind: "drifted",
        minutes: 45,
      }),
    );
    await post(
      body({ objective_ids: [y], local_date: "2026-10-01", minutes: 20 }),
    );

    const all = (await (
      await get("?from=2026-09-01&to=2026-09-30")
    ).json()) as Listed;
    expect(all.deviations.map((d) => d.local_date)).toEqual([
      "2026-09-17",
      "2026-09-15",
    ]);
    expect(all.cost).toEqual({
      chosen: { count: 1, minutes: 30 },
      drifted: { count: 1, minutes: 45 },
    });

    const onlyY = (await (
      await get(`?from=2026-09-01&to=2026-10-31&objective_id=${y}`)
    ).json()) as Listed;
    expect(onlyY.deviations.map((d) => d.local_date)).toEqual([
      "2026-10-01",
      "2026-09-17",
    ]);
    // A deviation lists every objective it names, not only the filter's.
    expect(onlyY.deviations[1].objective_ids).toEqual([x, y].sort());
  });

  it("400s a missing or reversed range", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get("?from=2026-09-30&to=2026-09-01")).status).toBe(400);
    expect(
      (await get("?from=2026-09-01&to=2026-09-30&objective_id=x")).status,
    ).toBe(400);
  });
});
