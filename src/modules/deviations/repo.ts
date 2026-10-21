import { query, withTransaction } from "@/shared/db";
import type { PlanSegmentRow } from "@/modules/objectives/domain/segmentRows";
import type { StatusEventRow } from "@/modules/objectives/domain/statusTimeline";
import type { DeviationWrite } from "./domain/deviationWrite";
import type { PatternWrite } from "./domain/validatePatternWrite";

/**
 * deviations/repo — the only file in this module with SQL (ADR-001). Every
 * table here carries user_id, and every read filters by it (NFR-10).
 */

export type PatternRow = {
  id: string;
  name: string;
  description: string | null;
  occurrences: number;
};

/** The caller's patterns, each with how many deviations name it. One query. */
export async function listPatterns(userId: string): Promise<PatternRow[]> {
  const res = await query<PatternRow>(
    `SELECT p.id, p.name, p.description,
            (SELECT count(*)::int FROM deviation d WHERE d.pattern_id = p.id)
              AS occurrences
     FROM deviation_pattern p
     WHERE p.user_id = $1
     ORDER BY lower(p.name), p.id`,
    [userId],
  );
  return res.rows;
}

export type InsertPattern =
  { ok: true; pattern: PatternRow } | { ok: false; kind: "duplicate" };

/** A new pattern. The unique index decides a duplicate name, not a lookup. */
export async function insertPattern(
  userId: string,
  p: PatternWrite,
): Promise<InsertPattern> {
  try {
    const res = await query<PatternRow>(
      `INSERT INTO deviation_pattern (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, 0 AS occurrences`,
      [userId, p.name, p.description],
    );
    return { ok: true, pattern: res.rows[0] };
  } catch (e) {
    const pgErr = e as { code?: string; constraint?: string };
    if (
      pgErr.code === "23505" &&
      pgErr.constraint === "deviation_pattern_user_name_key"
    ) {
      return { ok: false, kind: "duplicate" };
    }
    throw e;
  }
}

/** A deviation as the contract shows it, straight from SQL. */
export type DeviationRow = {
  id: string;
  objective_ids: string[];
  local_date: string;
  tz: string;
  kind: "chosen" | "drifted";
  what_happened: string;
  /** Null on a drifted deviation. */
  reasoning: string | null;
  did_instead: string | null;
  minutes: number;
  pattern_id: string | null;
  pattern_name: string | null;
  verdict: "worth_it" | "not_worth_it" | null;
  verdict_review_id: string | null;
};

/** The columns of a deviation `d`, its pattern `p` joined, as DeviationRow. */
export const DEVIATION_COLUMNS = `
  d.id,
  ARRAY(SELECT x.objective_id FROM deviation_objective x
        WHERE x.deviation_id = d.id ORDER BY x.objective_id) AS objective_ids,
  to_char(d.local_date, 'YYYY-MM-DD') AS local_date,
  d.tz, d.kind, d.what_happened, d.reasoning, d.did_instead, d.minutes,
  d.pattern_id, p.name AS pattern_name, d.verdict, d.verdict_review_id`;

export type DeviationFacts = {
  tz: string;
  objectives: {
    id: string;
    segments: PlanSegmentRow[];
    status_events: StatusEventRow[];
  }[];
  pattern_is_theirs: boolean;
};

/**
 * What the write rules need, in one query: the caller's zone, those of the
 * named objectives that are the caller's (with their plan and status), and
 * whether the pattern named is theirs.
 */
export async function getDeviationFacts(
  userId: string,
  objectiveIds: string[],
  patternId: string | null,
): Promise<DeviationFacts> {
  const res = await query<DeviationFacts>(
    `SELECT u.tz,
       COALESCE((
         SELECT json_agg(json_build_object(
           'id', o.id,
           'segments', (
             SELECT json_agg(json_build_object(
               'seq', s.seq,
               'schedule_mode', s.schedule_mode,
               'planned_weekdays', s.planned_weekdays,
               'days_per_week', s.days_per_week,
               'minutes_per_planned_day', s.minutes_per_planned_day,
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
         FROM objective o
         WHERE o.user_id = u.id AND o.id = ANY($2::uuid[])
       ), '[]'::json) AS objectives,
       EXISTS (
         SELECT 1 FROM deviation_pattern p
         WHERE p.id = $3::uuid AND p.user_id = u.id
       ) AS pattern_is_theirs
     FROM "user" u WHERE u.id = $1`,
    [userId, objectiveIds, patternId],
  );
  return res.rows[0];
}

/**
 * Write the deviation and the objectives it names, all or nothing: a
 * deviation naming no objective cannot be left behind (ERD, *Deviation
 * objective*). Returns it as the contract shows it.
 */
export async function insertDeviation(
  userId: string,
  w: DeviationWrite,
): Promise<DeviationRow> {
  return withTransaction(async (tx) => {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO deviation
         (user_id, local_date, tz, kind, what_happened, reasoning,
          did_instead, minutes, pattern_id)
       VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        userId,
        w.local_date,
        w.tz,
        w.kind,
        w.what_happened,
        w.reasoning,
        w.did_instead,
        w.minutes,
        w.pattern_id,
      ],
    );
    const id = inserted.rows[0].id;
    await tx.query(
      `INSERT INTO deviation_objective (deviation_id, objective_id, user_id)
       SELECT $1, unnest($2::uuid[]), $3`,
      [id, w.objective_ids, userId],
    );
    const row = await tx.query<DeviationRow>(
      `SELECT ${DEVIATION_COLUMNS}
       FROM deviation d LEFT JOIN deviation_pattern p ON p.id = d.pattern_id
       WHERE d.id = $1`,
      [id],
    );
    return row.rows[0];
  });
}

/**
 * The caller's deviations in a date range, newest first, optionally only
 * those naming one objective. Each lists every objective it names, not only
 * the one filtered on. One query.
 */
export async function listDeviations(
  userId: string,
  from: string,
  to: string,
  objectiveId: string | null,
): Promise<DeviationRow[]> {
  const res = await query<DeviationRow>(
    `SELECT ${DEVIATION_COLUMNS}
     FROM deviation d LEFT JOIN deviation_pattern p ON p.id = d.pattern_id
     WHERE d.user_id = $1
       AND d.local_date BETWEEN $2::date AND $3::date
       AND ($4::uuid IS NULL OR EXISTS (
         SELECT 1 FROM deviation_objective x
         WHERE x.deviation_id = d.id AND x.objective_id = $4::uuid))
     ORDER BY d.local_date DESC, d.recorded_at DESC`,
    [userId, from, to, objectiveId],
  );
  return res.rows;
}
