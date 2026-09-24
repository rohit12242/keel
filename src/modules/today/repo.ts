import { query } from "@/shared/db";
import type { DayObjectiveRow } from "@/modules/today/domain/rows";

/**
 * The Today read (NFR-03): one query, no query-per-objective.
 *
 * Since W4-29 it reads **facts only** and joins no `plan_slot` (ADR-008). It
 * returns, per objective of this user: its plan segments, its status events, the
 * entries logged on the date, and the objective's minutes for that week. The
 * domain then computes the covering slot, whether each entry is extra, the next
 * planned date, and which objectives are active — all from these rows, with no
 * second read.
 *
 * Note what is NOT here: no `WHERE o.status = 'active'`, because the status is
 * the latest status event, and deriving it in SQL would be a second
 * implementation of a rule that lives in `domain/`. Every objective of the user
 * comes back and the assembler drops the ones that are not active.
 */

const DAY_SQL = `
WITH obj AS (
  SELECT o.id, o.title
  FROM objective o
  WHERE o.user_id = $1
),
seg AS (
  SELECT s.objective_id,
    json_agg(json_build_object(
      'seq', s.seq,
      'schedule_mode', s.schedule_mode,
      'planned_weekdays', s.planned_weekdays,
      'days_per_week', s.days_per_week,
      'minutes_per_planned_day', s.minutes_per_planned_day,
      'start_date', to_char(s.start_date, 'YYYY-MM-DD'),
      'end_date', to_char(s.end_date, 'YYYY-MM-DD')
    ) ORDER BY s.seq) AS segments
  FROM plan_segment s
  JOIN obj ON obj.id = s.objective_id
  GROUP BY s.objective_id
),
ev AS (
  SELECT e.objective_id,
    json_agg(json_build_object(
      'occurred_on', to_char(e.occurred_on, 'YYYY-MM-DD'),
      'change', e.change
    ) ORDER BY e.occurred_on, e.recorded_at) AS status_events
  FROM status_event e
  JOIN obj ON obj.id = e.objective_id
  GROUP BY e.objective_id
),
ent AS (
  SELECT e.objective_id,
    json_agg(json_build_object(
      'id', e.id,
      'objective_id', e.objective_id,
      'local_date', to_char(e.local_date, 'YYYY-MM-DD'),
      'tz', e.tz,
      'minutes', e.minutes,
      'note', e.note,
      'link', e.link,
      'occurred_at_local', to_char(e.occurred_at_local, 'HH24:MI'),
      'logged_at', to_char(e.logged_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ) ORDER BY e.logged_at) AS entries
  FROM effort_entry e
  JOIN obj ON obj.id = e.objective_id
  WHERE e.local_date = $2::date
  GROUP BY e.objective_id
),
wk AS (
  SELECT e.objective_id, COALESCE(SUM(e.minutes), 0)::int AS week_minutes
  FROM effort_entry e
  JOIN obj ON obj.id = e.objective_id
  WHERE e.local_date BETWEEN date_trunc('week', $2::date)::date
                         AND (date_trunc('week', $2::date)::date + 6)
  GROUP BY e.objective_id
)
SELECT
  obj.id, obj.title,
  COALESCE(seg.segments, '[]'::json) AS segments,
  COALESCE(ev.status_events, '[]'::json) AS status_events,
  COALESCE(ent.entries, '[]'::json) AS entries,
  COALESCE(wk.week_minutes, 0) AS week_minutes
FROM obj
LEFT JOIN seg ON seg.objective_id = obj.id
LEFT JOIN ev ON ev.objective_id = obj.id
LEFT JOIN ent ON ent.objective_id = obj.id
LEFT JOIN wk ON wk.objective_id = obj.id
ORDER BY obj.title
`;

export async function getDayRows(
  userId: string,
  date: string,
): Promise<DayObjectiveRow[]> {
  const result = await query<DayObjectiveRow>(DAY_SQL, [userId, date]);
  return result.rows;
}
