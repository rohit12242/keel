import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import type { Note, Objective } from "@/shared/contract";
import * as notes from "@/app/v1/objectives/[objectiveId]/notes/route";
import * as one from "@/app/v1/objectives/[objectiveId]/route";
import {
  addStatusEvents,
  testObjective,
  testUser,
  type TestUser,
} from "@/test/fixtures";

/**
 * I-03 step 8 — notes on an objective (G2), every declared response. A note
 * is append-only, open in every state, and returned inside the objective.
 */
let me: TestUser;
let objectiveId: string;

const params = (id: string) => ({
  params: Promise.resolve({ objectiveId: id }),
});
const post = (body: unknown, id = objectiveId) =>
  notes.POST(
    new Request(`http://keel.test/v1/objectives/${id}/notes`, {
      method: "POST",
      headers: { cookie: me.cookie },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    params(id),
  );
const read = async (id = objectiveId) =>
  (await (
    await one.GET(
      new Request(`http://keel.test/v1/objectives/${id}`, {
        headers: { cookie: me.cookie },
      }),
      params(id),
    )
  ).json()) as Objective;

describe("notes on an objective (real Postgres)", () => {
  beforeEach(async () => {
    me = await testUser();
    objectiveId = (await testObjective(me)).id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("201s a note, and the objective returns its notes oldest first", async () => {
    const res = await post({ written_on: "2026-09-18", text: "Second." });
    expect(res.status).toBe(201);
    const made = (await res.json()) as Note;
    expect(made).toMatchObject({ written_on: "2026-09-18", text: "Second." });
    expect(made.id).toMatch(/^[0-9a-f-]{36}$/);
    await post({ written_on: "2026-09-15", text: "First." });
    await post({ written_on: "2026-09-18", text: "Third, same day." });
    expect((await read()).notes.map((n) => n.text)).toEqual([
      "First.",
      "Second.",
      "Third, same day.",
    ]);
  });

  it("takes a note on a completed or an ended objective", async () => {
    const completed = (await testObjective(me)).id;
    await addStatusEvents(completed, [["2026-10-11", "completed"]]);
    const ended = (await testObjective(me)).id;
    await addStatusEvents(ended, [["2026-09-20", "ended"]]);
    for (const id of [completed, ended]) {
      expect(
        (await post({ written_on: "2026-10-12", text: "After." }, id)).status,
      ).toBe(201);
    }
  });

  it("400s a body that is not a note or not JSON", async () => {
    expect((await post({ written_on: "soon", text: "" })).status).toBe(400);
    expect((await post("{nope")).status).toBe(400);
  });

  it("422s a note dated after today, writing nothing", async () => {
    expect(
      (await post({ written_on: "2099-01-01", text: "Later." })).status,
    ).toBe(422);
    expect((await read()).notes).toEqual([]);
  });

  it("404s an id that is not a UUID, or another user's objective, writing nothing", async () => {
    expect(
      (await post({ written_on: "2026-09-18", text: "x" }, "nope")).status,
    ).toBe(404);
    const theirs = (await testObjective(await testUser())).id;
    expect(
      (await post({ written_on: "2026-09-18", text: "x" }, theirs)).status,
    ).toBe(404);
    const written = await query(
      `SELECT 1 FROM objective_note WHERE objective_id = $1`,
      [theirs],
    );
    expect(written.rowCount).toBe(0);
  });
});
