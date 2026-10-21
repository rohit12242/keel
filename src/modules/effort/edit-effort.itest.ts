import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import type { EffortEntry } from "@/shared/contract";
import type { EffortEntryRow } from "./repo";
import * as route from "@/app/v1/effort-entries/[entryId]/route";
import {
  addStatusEvents,
  testEntry,
  testObjective,
  testUser,
  type TestUser,
} from "@/test/fixtures";

/**
 * I-02 step 9 — correcting effort, every response the contract declares,
 * through the route. Each case has its own user and objective (fixed Mon–Fri,
 * 2026-09-14 … 2026-10-11).
 */
let me: TestUser;
let objectiveId: string;
let entry: EffortEntryRow;

const params = (entryId: string) => ({
  params: Promise.resolve({ entryId }),
});

const patch = (id: string, body: unknown) =>
  route.PATCH(
    new Request(`http://keel.test/v1/effort-entries/${id}`, {
      method: "PATCH",
      headers: { cookie: me.cookie },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    params(id),
  );

const del = (id: string) =>
  route.DELETE(
    new Request(`http://keel.test/v1/effort-entries/${id}`, {
      method: "DELETE",
      headers: { cookie: me.cookie },
    }),
    params(id),
  );

const stored = async (id: string) =>
  (
    await query<{ minutes: number; local_date: string }>(
      `SELECT minutes, to_char(local_date, 'YYYY-MM-DD') AS local_date
       FROM effort_entry WHERE id = $1`,
      [id],
    )
  ).rows[0];

describe("editing and deleting effort (real Postgres)", () => {
  beforeEach(async () => {
    me = await testUser();
    objectiveId = (await testObjective(me)).id;
    entry = await testEntry(objectiveId); // Wednesday 2026-09-16, planned
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("200s an edit and returns the entry, still on its own day", async () => {
    const res = await patch(entry.id, { minutes: 90, note: "corrected" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: entry.id,
      local_date: "2026-09-16",
      minutes: 90,
      note: "corrected",
      extra: false,
    });
    expect(await stored(entry.id)).toEqual({
      minutes: 90,
      local_date: "2026-09-16",
    });
  });

  it("keeps an off-day entry extra after an edit — derived, not stored", async () => {
    const saturday = await testEntry(objectiveId, {
      local_date: "2026-09-19",
    });
    const res = await patch(saturday.id, { minutes: 20 });
    expect(((await res.json()) as EffortEntry).extra).toBe(true);
  });

  it("422s an edit that moves into another of the user's entries that day, and changes nothing", async () => {
    // entry is 09:00–10:00; another objective has 10:30–11:30.
    const other = (await testObjective(me)).id;
    await testEntry(other, { occurred_at_local: "10:30" });
    const res = await patch(entry.id, { minutes: 45 }); // 09:00–09:45: fine
    expect(res.status).toBe(200);
    expect((await patch(entry.id, { occurred_at_local: "10:00" })).status).toBe(
      422,
    );
    expect((await patch(entry.id, { minutes: 120 })).status).toBe(422);
    expect(await stored(entry.id)).toEqual({
      minutes: 45,
      local_date: "2026-09-16",
    });
  });

  it("200s an edit that keeps its own time — an entry never overlaps itself", async () => {
    const res = await patch(entry.id, { occurred_at_local: "09:00" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as EffortEntry).occurred_at_local).toBe("09:00");
  });

  it("400s a change of day, and changes nothing", async () => {
    const res = await patch(entry.id, {
      local_date: "2026-09-17",
      minutes: 10,
    });
    expect(res.status).toBe(400);
    expect(await stored(entry.id)).toEqual({
      minutes: 60,
      local_date: "2026-09-16",
    });
  });

  it("400s a body that is not JSON, or changes nothing", async () => {
    expect((await patch(entry.id, "{nope")).status).toBe(400);
    expect((await patch(entry.id, {})).status).toBe(400);
  });

  it("404s an id that is not a UUID, or names no entry", async () => {
    expect((await patch("nope", { minutes: 5 })).status).toBe(404);
    expect((await del("nope")).status).toBe(404);
    const nobody = "00000000-0000-0000-0000-00000000dead";
    expect((await patch(nobody, { minutes: 5 })).status).toBe(404);
    expect((await del(nobody)).status).toBe(404);
  });

  it("422s an edit or a delete once the objective is not active", async () => {
    await addStatusEvents(objectiveId, [["2026-09-20", "paused"]]);
    expect((await patch(entry.id, { minutes: 5 })).status).toBe(422);
    expect((await del(entry.id)).status).toBe(422);
    expect(await stored(entry.id)).toEqual({
      minutes: 60,
      local_date: "2026-09-16",
    });
  });

  it("204s a delete, and the entry is gone", async () => {
    expect((await del(entry.id)).status).toBe(204);
    expect(await stored(entry.id)).toBeUndefined();
  });
});
