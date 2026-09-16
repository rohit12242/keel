import { query } from "@/shared/db";
import type { DayObjectiveRow } from "@/modules/today/domain/rows";

/**
 * The Today read (NFR-03): one query, no query-per-objective. Returns one row
 * per active objective, carrying — for the given date — the covering plan slot,
 * that date's entries (each with the computed `extra` flag), the objective's
 * logged and extra minutes for the day, its next planned date, and the
 * week-to-date total (repeated on each row via the cross join). The application
 * issues this once; the DB does the joining.
 */

const DAY_SQL = `
WITH obj AS (
  SELECT o.id, o.title
  FROM objective o
  WHERE o.user_id = $1 AND o.status = 'active'
),
seg AS (
  SELECT DISTINCT ON (s.objective_id)
    s.objective_id, s.id AS segment_id, s.schedule_mode, s.planned_weekdays,
    s.days_per_week, s.minutes_per_planned_day
  FROM plan_segment s
  JOIN obj ON obj.id = s.objective_id
  ORDER BY s.objective_id,
    (s.start_date <= $2::date AND s.end_date >= $2::date) DESC, s.seq DESC
),
cover_slot AS (
  SELECT ps.plan_segment_id, ps.id, ps.period_kind, ps.period_start,
         ps.period_end, ps.target_minutes, ps.target_days
  FROM plan_slot ps
  JOIN seg ON seg.segment_id = ps.plan_segment_id
  WHERE ps.period_start <= $2::date AND ps.period_end >= $2::date
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
      'logged_at', to_char(e.logged_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'extra', NOT EXISTS (
        SELECT 1 FROM plan_slot ps2
        JOIN plan_segment s2 ON s2.id = ps2.plan_segment_id
        WHERE s2.objective_id = e.objective_id
          AND ps2.period_kind = 'day' AND ps2.period_start = e.local_date
      )
    ) ORDER BY e.logged_at) AS entries,
    COALESCE(SUM(e.minutes), 0)::int AS logged_minutes,
    COALESCE(SUM(e.minutes) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM plan_slot ps3
      JOIN plan_segment s3 ON s3.id = ps3.plan_segment_id
      WHERE s3.objective_id = e.objective_id
        AND ps3.period_kind = 'day' AND ps3.period_start = e.local_date
    )), 0)::int AS extra_minutes
  FROM effort_entry e
  JOIN obj ON obj.id = e.objective_id
  WHERE e.local_date = $2::date
  GROUP BY e.objective_id
),
wk AS (
  SELECT COALESCE(SUM(e.minutes), 0)::int AS week_minutes
  FROM effort_entry e
  JOIN obj ON obj.id = e.objective_id
  WHERE e.local_date BETWEEN date_trunc('week', $2::date)::date
                         AND (date_trunc('week', $2::date)::date + 6)
),
nextp AS (
  SELECT seg.objective_id, MIN(ps.period_start) AS next_planned_date
  FROM plan_slot ps
  JOIN seg ON seg.segment_id = ps.plan_segment_id
  WHERE ps.period_kind = 'day' AND ps.period_start > $2::date
  GROUP BY seg.objective_id
)
SELECT
  obj.id, obj.title,
  seg.schedule_mode, seg.planned_weekdays, seg.days_per_week,
  seg.minutes_per_planned_day,
  cover_slot.id AS slot_id, cover_slot.period_kind,
  to_char(cover_slot.period_start, 'YYYY-MM-DD') AS period_start,
  to_char(cover_slot.period_end, 'YYYY-MM-DD') AS period_end,
  cover_slot.target_minutes, cover_slot.target_days,
  COALESCE(ent.entries, '[]'::json) AS entries,
  COALESCE(ent.logged_minutes, 0) AS logged_minutes,
  COALESCE(ent.extra_minutes, 0) AS extra_minutes,
  to_char(nextp.next_planned_date, 'YYYY-MM-DD') AS next_planned_date,
  wk.week_minutes
FROM obj
LEFT JOIN seg ON seg.objective_id = obj.id
LEFT JOIN cover_slot ON cover_slot.plan_segment_id = seg.segment_id
LEFT JOIN ent ON ent.objective_id = obj.id
LEFT JOIN nextp ON nextp.objective_id = obj.id
CROSS JOIN wk
ORDER BY obj.title
`;

export async function getDayRows(
  userId: string,
  date: string,
): Promise<DayObjectiveRow[]> {
  const result = await query<DayObjectiveRow>(DAY_SQL, [userId, date]);
  return result.rows;
}
