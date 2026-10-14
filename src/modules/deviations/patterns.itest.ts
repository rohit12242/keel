import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool } from "@/shared/db";
import * as route from "@/app/v1/deviation-patterns/route";
import { testUser, type TestUser } from "@/test/fixtures";

/** I-02 step 14 — deviation patterns through the route, every declared response. */
let me: TestUser;

const list = async (who = me) => {
  const res = await route.GET(
    new Request("http://keel.test/v1/deviation-patterns", {
      headers: { cookie: who.cookie },
    }),
    undefined,
  );
  expect(res.status).toBe(200);
  return (
    (await res.json()) as { patterns: { name: string; occurrences: number }[] }
  ).patterns;
};
const create = (body: unknown) =>
  route.POST(
    new Request("http://keel.test/v1/deviation-patterns", {
      method: "POST",
      headers: { cookie: me.cookie },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    undefined,
  );

describe("deviation patterns (real Postgres)", () => {
  beforeEach(async () => {
    me = await testUser();
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("201s a new pattern with no occurrences, and lists it", async () => {
    const res = await create({
      name: "Planning instead of doing",
      description: "Reading about it rather than doing it.",
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      name: "Planning instead of doing",
      description: "Reading about it rather than doing it.",
      occurrences: 0,
    });
    expect(await list()).toEqual([
      expect.objectContaining({
        name: "Planning instead of doing",
        occurrences: 0,
      }),
    ]);
  });

  it("409s a name already used, whatever its case", async () => {
    await create({ name: "Self-doubt" });
    expect((await create({ name: "SELF-DOUBT" })).status).toBe(409);
    expect(await list()).toHaveLength(1);
  });

  it("400s a body that is not JSON, or has no name", async () => {
    expect((await create("{nope")).status).toBe(400);
    expect((await create({ description: "no name" })).status).toBe(400);
  });

  it("lists only the caller's patterns", async () => {
    await create({ name: "Mine" });
    const other = await testUser();
    expect(await list(other)).toEqual([]);
  });
});
