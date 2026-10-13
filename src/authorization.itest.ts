import { afterAll, describe, expect, it } from "vitest";
import { getPool, query } from "@/shared/db";
import { AUTHORIZATION } from "@/test/authorization-table";
import { testUser } from "@/test/fixtures";

/**
 * NFR-10 and NFR-11's authorisation suite: every operation that needs a
 * session, run through its real route handler. No cookie is a 401 that reads
 * and writes nothing. Someone else's row is a 404 — never a 403, which would
 * confirm the row exists — and changes nothing of theirs.
 */
async function problemStatus(res: Response): Promise<number> {
  expect(res.headers.get("content-type")).toBe("application/problem+json");
  return ((await res.json()) as { status: number }).status;
}

/**
 * Rows a refused request could have written: the given user's, or with no
 * user, everyone's. Files run one at a time, so nothing else writes between
 * the two reads.
 */
async function footprint(userId: string | null): Promise<string> {
  const res = await query<{ n: string }>(
    `SELECT (SELECT count(*) FROM objective o
              WHERE $1::uuid IS NULL OR o.user_id = $1)
          + (SELECT count(*) FROM effort_entry e JOIN objective o ON o.id = e.objective_id
              WHERE $1::uuid IS NULL OR o.user_id = $1)
          + (SELECT count(*) FROM status_event s JOIN objective o ON o.id = s.objective_id
              WHERE $1::uuid IS NULL OR o.user_id = $1)
          + (SELECT count(*) FROM plan_segment p JOIN objective o ON o.id = p.objective_id
              WHERE $1::uuid IS NULL OR o.user_id = $1)
       AS n`,
    [userId],
  );
  return res.rows[0].n;
}

describe("authorisation (real Postgres)", () => {
  afterAll(async () => {
    await getPool().end();
  });

  describe.each(AUTHORIZATION)("$operationId", (row) => {
    it("401s without a session, and writes nothing", async () => {
      const owner = await testUser();
      const id = row.resource ? await row.resource(owner) : "";
      const before = await footprint(null);
      expect(await problemStatus(await row.call(null, id))).toBe(401);
      expect(await footprint(null)).toBe(before);
    });

    it.runIf(row.resource !== undefined)(
      "404s another user's row, and changes nothing of theirs",
      async () => {
        const me = await testUser();
        const them = await testUser();
        const theirs = await row.resource!(them);
        const before = await footprint(them.id);
        expect(await problemStatus(await row.call(me.cookie, theirs))).toBe(
          404,
        );
        expect(await footprint(them.id)).toBe(before);
      },
    );
  });
});
