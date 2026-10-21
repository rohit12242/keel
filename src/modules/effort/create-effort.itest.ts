import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import {
  addStatusEvents,
  daysFrom,
  testObjectiveToday,
  testUser,
  todayIn,
  type TestUser,
} from "@/test/fixtures";
import { createEffortEntry } from "./service";

/**
 * Logging effort through the use case, every rule and failure path: the
 * status is the latest event, `extra` is "no computed slot covers this
 * date" (W4-29), effort is logged only for today in its own zone (G21), and
 * a user's entries on one day never overlap (G29, invariant 18).
 *
 * Each case has its own user, and an objective whose plan covers today.
 */
const TZ = "Asia/Kolkata";
const NOTE = "itest: effort write";
let today: string;

function body(over: Record<string, unknown> = {}) {
  return {
    local_date: today,
    tz: TZ,
    occurred_at_local: "09:20",
    minutes: 60,
    note: NOTE,
    ...over,
  };
}

let user: TestUser;
let OBJECTIVE_ID: string;

/** Log as the case's own user, now. */
const log = (objectiveId: string, b: unknown) =>
  createEffortEntry(user.id, objectiveId, b, new Date());

describe("createEffortEntry (real Postgres)", () => {
  beforeEach(async () => {
    today = todayIn(TZ);
    user = await testUser();
    OBJECTIVE_ID = (await testObjectiveToday(user)).id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  // --- failure paths --------------------------------------------------------

  it("refuses a body that is not valid (400)", async () => {
    const result = await log(OBJECTIVE_ID, body({ minutes: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "validation") {
      expect(result.errors.map((e) => e.field)).toContain("minutes");
    } else {
      expect.unreachable("expected a validation failure");
    }
  });

  it("is not_found for an objective that does not exist (404)", async () => {
    const result = await log("00000000-0000-0000-0000-00000000dead", body());
    expect(result).toMatchObject({ ok: false, kind: "not_found" });
  });

  it("is not_found for another user's objective, and writes nothing (404, NFR-10)", async () => {
    const someoneElse = await testUser();
    const theirs = await testObjectiveToday(someoneElse);
    expect(await log(theirs.id, body())).toMatchObject({
      ok: false,
      kind: "not_found",
    });
    const written = await query(
      "SELECT 1 FROM effort_entry WHERE objective_id = $1",
      [theirs.id],
    );
    expect(written.rowCount).toBe(0);
  });

  it("is not_today for yesterday or tomorrow, inside the plan, and writes nothing", async () => {
    for (const local_date of [daysFrom(today, -1), daysFrom(today, 1)]) {
      expect(await log(OBJECTIVE_ID, body({ local_date }))).toMatchObject({
        ok: false,
        kind: "not_today",
      });
    }
    const written = await query(
      "SELECT 1 FROM effort_entry WHERE objective_id = $1",
      [OBJECTIVE_ID],
    );
    expect(written.rowCount).toBe(0);
  });

  it("judges today in the zone the entry is logged in", async () => {
    // Kiritimati (UTC+14) and Pago Pago (UTC−11) are never on the same date.
    const kiritimati = todayIn("Pacific/Kiritimati");
    expect(
      (
        await log(
          OBJECTIVE_ID,
          body({ local_date: kiritimati, tz: "Pacific/Kiritimati" }),
        )
      ).ok,
    ).toBe(true);
    expect(
      await log(
        OBJECTIVE_ID,
        body({
          local_date: kiritimati,
          tz: "Pacific/Pago_Pago",
          occurred_at_local: "15:00",
        }),
      ),
    ).toMatchObject({ ok: false, kind: "not_today" });
  });

  it("is not_active once the objective has ended — read from the events, not a column", async () => {
    await addStatusEvents(OBJECTIVE_ID, [[daysFrom(today, -1), "ended"]]);
    expect(await log(OBJECTIVE_ID, body())).toMatchObject({
      ok: false,
      kind: "not_active",
    });
  });

  it("is outside_plan for today when the plan has not started", async () => {
    const later = await testObjectiveToday(user, {
      starts_on: daysFrom(today, 1),
    });
    expect(await log(later.id, body())).toMatchObject({
      ok: false,
      kind: "outside_plan",
    });
  });

  it("is overlap for an entry that overlaps another of the user's that day, under any objective — and writes nothing", async () => {
    const other = (await testObjectiveToday(user)).id;
    expect((await log(other, body())).ok).toBe(true); // 09:20–10:20
    const result = await log(
      OBJECTIVE_ID,
      body({ occurred_at_local: "10:00", note: "overlap probe" }),
    );
    expect(result).toMatchObject({ ok: false, kind: "overlap" });
    if (!result.ok && result.kind === "overlap") {
      expect(result.detail).toContain("09:20–10:20");
    }
    const written = await query(
      "SELECT 1 FROM effort_entry WHERE note = 'overlap probe' AND objective_id = $1",
      [OBJECTIVE_ID],
    );
    expect(written.rowCount).toBe(0);
  });

  it("allows an entry that only touches another, or overlaps another user's", async () => {
    expect((await log(OBJECTIVE_ID, body())).ok).toBe(true); // 09:20–10:20
    expect(
      (await log(OBJECTIVE_ID, body({ occurred_at_local: "10:20" }))).ok,
    ).toBe(true);
    const someoneElse = await testUser();
    const theirs = (await testObjectiveToday(someoneElse)).id;
    const theirLog = await createEffortEntry(
      someoneElse.id,
      theirs,
      body(),
      new Date(),
    );
    expect(theirLog.ok).toBe(true);
  });

  // --- what it writes -------------------------------------------------------

  it("logs a planned day as not extra", async () => {
    const result = await log(OBJECTIVE_ID, body());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.extra).toBe(false);
      expect(result.entry.local_date).toBe(today);
      expect(result.entry.occurred_at_local).toBe("09:20");
    }
  });

  it("logs an off day inside the plan as extra", async () => {
    const offToday = (await testObjectiveToday(user, { offToday: true })).id;
    const result = await log(offToday, body());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.entry.extra).toBe(true);
  });

  it("counts effort logged during a paused stretch as extra (invariant 10)", async () => {
    // Paused yesterday, resuming tomorrow: the objective reads active (its
    // latest event), so the write is allowed, but today was not planned.
    await addStatusEvents(OBJECTIVE_ID, [
      [daysFrom(today, -1), "paused"],
      [daysFrom(today, 1), "resumed"],
    ]);
    const result = await log(OBJECTIVE_ID, body());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.entry.extra).toBe(true);
  });
});
