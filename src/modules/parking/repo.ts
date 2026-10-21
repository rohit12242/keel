import { query, withTransaction, type Queryable } from "@/shared/db";
import type { StatusEventRow } from "@/modules/objectives/domain/statusTimeline";
import type { Note } from "@/shared/contract";
import type { NoteWrite } from "@/modules/objectives/domain/noteWrite";
import type { IdeaRow, IdeaWrite, VerdictWrite } from "./domain/parking";

/**
 * parking/repo — the only file in this module with SQL (ADR-001). An idea
 * carries user_id; a verdict reaches its user through its idea (NFR-10).
 */

/** An idea `i` as IdeaRow: its verdicts and notes oldest first, and the objective it became. */
export const IDEA_COLUMNS = `
  i.id, i.idea, i.why,
  to_char(i.caught_on, 'YYYY-MM-DD') AS caught_on,
  to_char(i.locked_until, 'YYYY-MM-DD') AS locked_until,
  (SELECT json_agg(json_build_object(
     'verdict', v.verdict,
     'note', v.note,
     'occurred_on', to_char(v.occurred_on, 'YYYY-MM-DD')
   ) ORDER BY v.occurred_on, v.recorded_at)
   FROM parked_idea_verdict v WHERE v.parked_idea_id = i.id) AS verdicts,
  COALESCE((SELECT json_agg(json_build_object(
     'id', n.id,
     'written_on', to_char(n.written_on, 'YYYY-MM-DD'),
     'text', n.text
   ) ORDER BY n.written_on, n.recorded_at)
   FROM parked_idea_note n WHERE n.parked_idea_id = i.id), '[]'::json) AS notes,
  (SELECT o.id FROM objective o WHERE o.from_parked_idea_id = i.id)
    AS became_objective_id`;

export type LockFacts = {
  tz: string;
  objectives: {
    segments: { start_date: string; end_date: string }[];
    status_events: StatusEventRow[];
  }[];
};

/** The caller's zone, and every objective's segments and status, for the lock. One query. */
export async function getLockFacts(userId: string): Promise<LockFacts> {
  const res = await query<LockFacts>(
    `SELECT u.tz,
       COALESCE((
         SELECT json_agg(json_build_object(
           'segments', (
             SELECT json_agg(json_build_object(
               'start_date', to_char(s.start_date, 'YYYY-MM-DD'),
               'end_date', to_char(s.end_date, 'YYYY-MM-DD')
             ) ORDER BY s.seq)
             FROM plan_segment s WHERE s.objective_id = o.id),
           'status_events', (
             SELECT json_agg(json_build_object(
               'occurred_on', to_char(e.occurred_on, 'YYYY-MM-DD'),
               'change', e.change
             ) ORDER BY e.occurred_on, e.recorded_at)
             FROM status_event e WHERE e.objective_id = o.id)
         ))
         FROM objective o WHERE o.user_id = u.id
       ), '[]'::json) AS objectives
     FROM "user" u WHERE u.id = $1`,
    [userId],
  );
  return res.rows[0];
}

/** Park an idea and record its first `parked` verdict, together or not at all. */
export async function insertIdea(
  userId: string,
  w: IdeaWrite,
  lockedUntil: string,
): Promise<IdeaRow> {
  return withTransaction(async (tx) => {
    const idea = await tx.query<{ id: string }>(
      `INSERT INTO parked_idea (user_id, idea, why, caught_on, locked_until)
       VALUES ($1, $2, $3, $4::date, $5::date) RETURNING id`,
      [userId, w.idea, w.why, w.caught_on, lockedUntil],
    );
    const id = idea.rows[0].id;
    await tx.query(
      `INSERT INTO parked_idea_verdict (parked_idea_id, verdict, occurred_on)
       VALUES ($1, 'parked', $2::date)`,
      [id, w.caught_on],
    );
    return readIdea(tx, userId, id) as Promise<IdeaRow>;
  });
}

async function readIdea(
  q: Queryable,
  userId: string,
  ideaId: string,
): Promise<IdeaRow | null> {
  const res = await q.query<IdeaRow>(
    `SELECT ${IDEA_COLUMNS} FROM parked_idea i
     WHERE i.id = $2 AND i.user_id = $1`,
    [userId, ideaId],
  );
  return res.rows[0] ?? null;
}

/** The caller's zone and every idea they parked, newest caught first. One query. */
export async function listIdeas(
  userId: string,
): Promise<{ tz: string; ideas: IdeaRow[] }> {
  const res = await query<{ tz: string; ideas: IdeaRow[] }>(
    `SELECT u.tz,
       COALESCE((
         SELECT json_agg(x ORDER BY x.caught_on DESC, x.id) FROM (
           SELECT ${IDEA_COLUMNS} FROM parked_idea i WHERE i.user_id = u.id
         ) x
       ), '[]'::json) AS ideas
     FROM "user" u WHERE u.id = $1`,
    [userId],
  );
  return res.rows[0];
}

/**
 * The caller's idea with its verdicts, the idea row locked for the rest of
 * the transaction so two verdicts — or a verdict and a take — cannot both be
 * checked against the same history. Null when it is not theirs.
 */
export async function lockIdea(
  tx: Queryable,
  userId: string,
  ideaId: string,
): Promise<IdeaRow | null> {
  const owned = await tx.query(
    `SELECT 1 FROM parked_idea WHERE id = $2 AND user_id = $1 FOR UPDATE`,
    [userId, ideaId],
  );
  if (owned.rowCount === 0) return null;
  return readIdea(tx, userId, ideaId);
}

/** Append a verdict and return the idea as it now stands. */
export async function insertVerdict(
  tx: Queryable,
  userId: string,
  ideaId: string,
  w: VerdictWrite | { verdict: "taken"; occurred_on: string; note: null },
): Promise<IdeaRow> {
  await tx.query(
    `INSERT INTO parked_idea_verdict (parked_idea_id, verdict, note, occurred_on)
     VALUES ($1, $2, $3, $4::date)`,
    [ideaId, w.verdict, w.note, w.occurred_on],
  );
  return readIdea(tx, userId, ideaId) as Promise<IdeaRow>;
}

/** The caller's zone, and whether the idea is theirs. One query. */
export async function getIdeaNoteFacts(
  userId: string,
  ideaId: string,
): Promise<{ tz: string; owned: boolean }> {
  const res = await query<{ tz: string; owned: boolean }>(
    `SELECT u.tz,
       EXISTS (SELECT 1 FROM parked_idea i WHERE i.id = $2 AND i.user_id = u.id)
         AS owned
     FROM "user" u WHERE u.id = $1`,
    [userId, ideaId],
  );
  return res.rows[0];
}

/**
 * Append a note. The insert names the owner, so a note cannot land on
 * another user's idea: no row comes back, and the caller answers 404.
 */
export async function insertIdeaNote(
  userId: string,
  ideaId: string,
  w: NoteWrite,
): Promise<Note | null> {
  const res = await query<Note>(
    `INSERT INTO parked_idea_note (parked_idea_id, written_on, text)
     SELECT i.id, $3::date, $4 FROM parked_idea i
     WHERE i.id = $2 AND i.user_id = $1
     RETURNING id, to_char(written_on, 'YYYY-MM-DD') AS written_on, text`,
    [userId, ideaId, w.written_on, w.text],
  );
  return res.rows[0] ?? null;
}
