import { query } from "@/shared/db";
import type { EffortEntryWrite } from "@/shared/contract";

/**
 * effort/repo — the only file in this module with SQL (ADR-001).
 */

export type ObjectiveEffortCheck = {
  status: "active" | "paused" | "completed" | "ended";
  date_covered: boolean;
};

/**
 * The objective's status and whether the date falls inside any of its plan
 * segments — the two things the 422 rule needs — for the current user. Null
 * when the objective does not exist or belongs to someone else (→ 404, NFR-10).
 */
export async function checkObjectiveForEffort(
  userId: string,
  objectiveId: string,
  date: string,
): Promise<ObjectiveEffortCheck | null> {
  const res = await query<ObjectiveEffortCheck>(
    `SELECT o.status,
       EXISTS (
         SELECT 1 FROM plan_segment s
         WHERE s.objective_id = o.id
           AND s.start_date <= $3::date AND s.end_date >= $3::date
       ) AS date_covered
     FROM objective o
     WHERE o.id = $2 AND o.user_id = $1`,
    [userId, objectiveId, date],
  );
  return res.rows[0] ?? null;
}

/** A row as returned by the insert (occurred_at_local/link may be null). */
export type EffortEntryRow = {
  id: string;
  objective_id: string;
  local_date: string;
  tz: string;
  minutes: number;
  note: string;
  occurred_at_local: string | null;
  link: string | null;
  logged_at: string;
  extra: boolean;
};

/**
 * Insert the entry. logged_at defaults to now() in the DB — never from the
 * client. `extra` is computed in the RETURNING (no day slot covers the date);
 * it is not a column and is never written.
 */
export async function insertEffortEntry(
  objectiveId: string,
  w: EffortEntryWrite,
): Promise<EffortEntryRow> {
  const res = await query<EffortEntryRow>(
    `INSERT INTO effort_entry
       (objective_id, local_date, occurred_at_local, tz, minutes, note, link)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7)
     RETURNING
       id, objective_id,
       to_char(local_date, 'YYYY-MM-DD') AS local_date,
       tz, minutes, note, link,
       to_char(occurred_at_local, 'HH24:MI') AS occurred_at_local,
       to_char(logged_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS logged_at,
       NOT EXISTS (
         SELECT 1 FROM plan_slot ps
         JOIN plan_segment s ON s.id = ps.plan_segment_id
         WHERE s.objective_id = $1
           AND ps.period_kind = 'day' AND ps.period_start = $2::date
       ) AS extra`,
    [
      objectiveId,
      w.local_date,
      w.occurred_at_local ?? null,
      w.tz,
      w.minutes,
      w.note,
      w.link ?? null,
    ],
  );
  return res.rows[0];
}
