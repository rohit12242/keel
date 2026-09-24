import { query } from "@/shared/db";
import type { EffortEntryWrite } from "@/shared/contract";
import type { PlanSegmentRow } from "@/modules/objectives/domain/segmentRows";
import type { StatusEventRow } from "@/modules/objectives/domain/statusTimeline";

/**
 * effort/repo — the only file in this module with SQL (ADR-001).
 */

export type ObjectiveForEffort = {
  segments: PlanSegmentRow[];
  status_events: StatusEventRow[];
};

/**
 * The facts the write rules need: the objective's plan segments and its status
 * events. Null when the objective does not exist or belongs to someone else
 * (→ 404, NFR-10).
 *
 * Since W4-29 this reads no `objective.status` column and no `plan_slot`: the
 * status is the latest status event and the covering slot is computed, both in
 * `domain/` (ADR-008). One query, as before.
 */
export async function getObjectiveForEffort(
  userId: string,
  objectiveId: string,
): Promise<ObjectiveForEffort | null> {
  const res = await query<ObjectiveForEffort>(
    `SELECT
       COALESCE((
         SELECT json_agg(json_build_object(
           'seq', s.seq,
           'schedule_mode', s.schedule_mode,
           'planned_weekdays', s.planned_weekdays,
           'days_per_week', s.days_per_week,
           'minutes_per_planned_day', s.minutes_per_planned_day,
           'start_date', to_char(s.start_date, 'YYYY-MM-DD'),
           'end_date', to_char(s.end_date, 'YYYY-MM-DD')
         ) ORDER BY s.seq)
         FROM plan_segment s WHERE s.objective_id = o.id
       ), '[]'::json) AS segments,
       COALESCE((
         SELECT json_agg(json_build_object(
           'occurred_on', to_char(e.occurred_on, 'YYYY-MM-DD'),
           'change', e.change
         ) ORDER BY e.occurred_on, e.recorded_at)
         FROM status_event e WHERE e.objective_id = o.id
       ), '[]'::json) AS status_events
     FROM objective o
     WHERE o.id = $2 AND o.user_id = $1`,
    [userId, objectiveId],
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
};

/**
 * Insert the entry. logged_at defaults to now() in the DB — never from the
 * client. `extra` is NOT here: it is a derivation, computed by the domain from
 * the segments and status events (ADR-008, W4-29), never stored and no longer
 * worked out in SQL.
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
       to_char(logged_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS logged_at`,
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
