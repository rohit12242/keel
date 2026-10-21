import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import type { EffortEntry } from "@/shared/contract";
import * as route from "@/app/v1/effort-entries/[entryId]/route";
import {
  addStatusEvents,
  daysFrom,
  testEntry,
  testObjectiveToday,
  testUser,
  todayIn,
  type TestUser,
} from "@/test/fixtures";
import type { EffortEntryRow } from "./repo";

/**
 * Correcting and deleting effort, every response the contract declares,
 * through the route. An entry changes only on its own day, in the zone it was
 * logged in (G21), and an edit may not move it into another entry (G29).
 * Each case has its own user, and an objective whose plan covers today.
 */
const TZ = "Asia/Kolkata";
let today: string;
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
    today = todayIn(TZ);
    me = await testUser();
    objectiveId = (await testObjectiveToday(me)).id;
    // Today, 09:00–10:00, on a planned day.
    entry = await testEntry(objectiveId, { local_date: today, tz: TZ });
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("200s an edit and returns the entry, still on its own day", async () => {
    const res = await patch(entry.id, { minutes: 90, note: "corrected" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: entry.id,
      local_date: today,
      minutes: 90,
      note: "corrected",
      extra: false,
    });
    expect(await stored(entry.id)).toEqual({ minutes: 90, local_date: today });
  });

  it("keeps an off-day entry extra after an edit — derived, not stored", async () => {
    const offToday = (await testObjectiveToday(me, { offToday: true })).id;
    const off = await testEntry(offToday, {
      local_date: today,
      tz: TZ,
      occurred_at_local: "12:00",
    });
    const res = await patch(off.id, { minutes: 20 });
    expect(((await res.json()) as EffortEntry).extra).toBe(true);
  });

  it("422s an edit or a delete once the entry's day is over, and changes nothing", async () => {
    const yesterday = await testEntry(objectiveId, {
      local_date: daysFrom(today, -1),
      tz: TZ,
    });
    expect((await patch(yesterday.id, { minutes: 5 })).status).toBe(422);
    expect((await del(yesterday.id)).status).toBe(422);
    expect(await stored(yesterday.id)).toEqual({
      minutes: 60,
      local_date: daysFrom(today, -1),
    });
  });

  it("judges the day in the zone the entry was logged in", async () => {
    // Pago Pago (UTC−11) is never on the same date as Kiritimati (UTC+14).
    const kiritimati = await testEntry(objectiveId, {
      local_date: todayIn("Pacific/Kiritimati"),
      tz: "Pacific/Kiritimati",
      occurred_at_local: "15:00",
    });
    expect((await patch(kiritimati.id, { minutes: 30 })).status).toBe(200);
    const pagoPago = await testEntry(objectiveId, {
      local_date: todayIn("Pacific/Kiritimati"),
      tz: "Pacific/Pago_Pago",
      occurred_at_local: "18:00",
    });
    expect((await patch(pagoPago.id, { minutes: 30 })).status).toBe(422);
  });

  it("422s an edit that moves into another of the user's entries that day, and changes nothing", async () => {
    // entry is 09:00–10:00; another objective has 10:30–11:30.
    const other = (await testObjectiveToday(me)).id;
    await testEntry(other, {
      local_date: today,
      tz: TZ,
      occurred_at_local: "10:30",
    });
    expect((await patch(entry.id, { minutes: 45 })).status).toBe(200);
    expect((await patch(entry.id, { occurred_at_local: "10:00" })).status).toBe(
      422,
    );
    expect((await patch(entry.id, { minutes: 120 })).status).toBe(422);
    expect(await stored(entry.id)).toEqual({ minutes: 45, local_date: today });
  });

  it("200s an edit that keeps its own time — an entry never overlaps itself", async () => {
    const res = await patch(entry.id, { occurred_at_local: "09:00" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as EffortEntry).occurred_at_local).toBe("09:00");
  });

  it("400s a change of day, and changes nothing", async () => {
    const res = await patch(entry.id, {
      local_date: daysFrom(today, 1),
      minutes: 10,
    });
    expect(res.status).toBe(400);
    expect(await stored(entry.id)).toEqual({ minutes: 60, local_date: today });
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
    await addStatusEvents(objectiveId, [[today, "paused"]]);
    expect((await patch(entry.id, { minutes: 5 })).status).toBe(422);
    expect((await del(entry.id)).status).toBe(422);
    expect(await stored(entry.id)).toEqual({ minutes: 60, local_date: today });
  });

  it("204s a delete on the entry's own day, and the entry is gone", async () => {
    expect((await del(entry.id)).status).toBe(204);
    expect(await stored(entry.id)).toBeUndefined();
  });
});
