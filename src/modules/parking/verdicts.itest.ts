import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import * as route from "@/app/v1/parked-ideas/[ideaId]/verdicts/route";
import { testIdea, testUser, type TestUser } from "@/test/fixtures";

/**
 * I-02 step 19, revised in I-03 — verdicts on a parked idea, every declared
 * response. The lock refuses nothing: a verdict before it lifts is recorded
 * as early. Dropped and taken are final, and a drop says why.
 */
let me: TestUser;

const post = (ideaId: string, body: unknown) =>
  route.POST(
    new Request(`http://keel.test/v1/parked-ideas/${ideaId}/verdicts`, {
      method: "POST",
      headers: { cookie: me.cookie },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ ideaId }) },
  );
const verdicts = async (ideaId: string) =>
  (
    await query<{ verdict: string }>(
      `SELECT verdict FROM parked_idea_verdict WHERE parked_idea_id = $1
       ORDER BY occurred_on, recorded_at`,
      [ideaId],
    )
  ).rows.map((r) => r.verdict);

describe("parked idea verdicts (real Postgres)", () => {
  beforeEach(async () => {
    me = await testUser();
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("201s parked and approved back and forth, then a drop, appending each", async () => {
    const idea = await testIdea(me);
    for (const verdict of ["approved", "parked"]) {
      const res = await post(idea.id, { verdict, occurred_on: "2026-10-01" });
      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({ verdict });
    }
    const dropped = await post(idea.id, {
      verdict: "dropped",
      occurred_on: "2026-10-02",
      note: "Not for me.",
    });
    expect(dropped.status).toBe(201);
    expect(await dropped.json()).toMatchObject({
      verdict: "dropped",
      note: "Not for me.",
    });
    expect(await verdicts(idea.id)).toEqual([
      "parked",
      "approved",
      "parked",
      "dropped",
    ]);
  });

  it("409s anything after a drop: it is final", async () => {
    const idea = await testIdea(me);
    await post(idea.id, {
      verdict: "dropped",
      occurred_on: "2026-10-01",
      note: "Not for me.",
    });
    expect(
      (await post(idea.id, { verdict: "parked", occurred_on: "2026-10-02" }))
        .status,
    ).toBe(409);
    expect(await verdicts(idea.id)).toEqual(["parked", "dropped"]);
  });

  it("201s a verdict while the idea is locked, recorded as early", async () => {
    // A lock far ahead of any real today, so the case never ages out; the
    // verdict itself must be dated by today, so the lock is set by hand.
    const locked = await testIdea(me, "2026-10-01");
    await query(
      `UPDATE parked_idea SET locked_until = '2099-01-31' WHERE id = $1`,
      [locked.id],
    );
    const res = await post(locked.id, {
      verdict: "approved",
      occurred_on: "2026-10-02",
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      verdict: "approved",
      locked: true,
      decided_early: true,
    });
  });

  it("422s a drop with no reason, or a verdict dated after today, recording nothing", async () => {
    const idea = await testIdea(me);
    expect(
      (await post(idea.id, { verdict: "dropped", occurred_on: "2026-10-01" }))
        .status,
    ).toBe(422);
    expect(
      (await post(idea.id, { verdict: "approved", occurred_on: "2099-01-01" }))
        .status,
    ).toBe(422);
    expect(await verdicts(idea.id)).toEqual(["parked"]);
  });

  it("409s a verdict once the idea is taken", async () => {
    const idea = await testIdea(me);
    await query(
      `INSERT INTO parked_idea_verdict (parked_idea_id, verdict, occurred_on)
       VALUES ($1, 'taken', '2026-10-01')`,
      [idea.id],
    );
    expect(
      (await post(idea.id, { verdict: "parked", occurred_on: "2026-10-02" }))
        .status,
    ).toBe(409);
  });

  it("400s taken, or a body that is not a verdict", async () => {
    const idea = await testIdea(me);
    expect(
      (await post(idea.id, { verdict: "taken", occurred_on: "2026-10-01" }))
        .status,
    ).toBe(400);
    expect((await post(idea.id, "{nope")).status).toBe(400);
  });

  it("404s an id that is not a UUID, or another user's idea", async () => {
    expect(
      (await post("nope", { verdict: "dropped", occurred_on: "2026-10-01" }))
        .status,
    ).toBe(404);
    const theirs = await testIdea(await testUser());
    expect(
      (await post(theirs.id, { verdict: "dropped", occurred_on: "2026-10-01" }))
        .status,
    ).toBe(404);
  });
});
