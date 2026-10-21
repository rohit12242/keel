import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import type { Note } from "@/shared/contract";
import * as notes from "@/app/v1/parked-ideas/[ideaId]/notes/route";
import * as ideas from "@/app/v1/parked-ideas/route";
import { testIdea, testUser, type TestUser } from "@/test/fixtures";
import type { ParkedIdea } from "./domain/parking";

/**
 * I-03 step 9 — notes on a parked idea (G3), every declared response. A note
 * is append-only, open in every state — dropped and taken included — and
 * returned on every idea in the list.
 */
let me: TestUser;
let ideaId: string;

const post = (body: unknown, id = ideaId) =>
  notes.POST(
    new Request(`http://keel.test/v1/parked-ideas/${id}/notes`, {
      method: "POST",
      headers: { cookie: me.cookie },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ ideaId: id }) },
  );
const listed = async (id = ideaId) =>
  (
    (await (
      await ideas.GET(
        new Request("http://keel.test/v1/parked-ideas", {
          headers: { cookie: me.cookie },
        }),
        undefined,
      )
    ).json()) as { ideas: ParkedIdea[] }
  ).ideas.find((i) => i.id === id) as ParkedIdea;
const finalVerdict = (id: string, verdict: "taken" | "dropped") =>
  query(
    `INSERT INTO parked_idea_verdict (parked_idea_id, verdict, note, occurred_on)
     VALUES ($1, $2, 'Final.', '2026-10-01')`,
    [id, verdict],
  );

describe("notes on a parked idea (real Postgres)", () => {
  beforeEach(async () => {
    me = await testUser();
    ideaId = (await testIdea(me)).id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("201s a note, and the idea returns its notes oldest first", async () => {
    const res = await post({ written_on: "2026-09-18", text: "Second." });
    expect(res.status).toBe(201);
    expect((await res.json()) as Note).toMatchObject({
      written_on: "2026-09-18",
      text: "Second.",
    });
    await post({ written_on: "2026-09-10", text: "First." });
    expect((await listed()).notes.map((n) => n.text)).toEqual([
      "First.",
      "Second.",
    ]);
  });

  it("takes a note on a dropped or a taken idea", async () => {
    for (const verdict of ["dropped", "taken"] as const) {
      const id = (await testIdea(me)).id;
      await finalVerdict(id, verdict);
      expect(
        (await post({ written_on: "2026-10-02", text: "After." }, id)).status,
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
    expect((await listed()).notes).toEqual([]);
  });

  it("404s an id that is not a UUID, or another user's idea, writing nothing", async () => {
    expect(
      (await post({ written_on: "2026-09-18", text: "x" }, "nope")).status,
    ).toBe(404);
    const theirs = (await testIdea(await testUser())).id;
    expect(
      (await post({ written_on: "2026-09-18", text: "x" }, theirs)).status,
    ).toBe(404);
    const written = await query(
      `SELECT 1 FROM parked_idea_note WHERE parked_idea_id = $1`,
      [theirs],
    );
    expect(written.rowCount).toBe(0);
  });
});
