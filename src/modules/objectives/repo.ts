import { query, type Queryable } from "@/shared/db";
import type { NewObjective } from "./domain/validateObjectiveWrite";
import { weekdaysToBitmask } from "./domain/weekdays";
import type { ObjectiveRow } from "./domain/rows";

/**
 * objectives/repo — the only file in this module with SQL (ADR-001).
 *
 * `plan_segment`, `status_event` and `effort_entry` carry no user_id
 * (ERD invariant 1): ownership travels through `objective`. So every read
 * below starts from the caller's objectives and joins everything else to
 * them — a CTE that skipped that join would leak another user's rows, and
 * nothing in the schema would catch it (NFR-10).
 */

/**
 * Write a new objective: the objective, segment 0 and its `created` event, on
 * the transaction it is given, so all three land or none do (ERD invariant 16:
 * the database holds "at most one created event"; this holds "at least one").
 * No slot is written anywhere — slots are computed (ADR-008).
 */
export async function insertObjective(
  tx: Queryable,
  userId: string,
  o: NewObjective,
): Promise<string> {
  const objective = await tx.query<{ id: string }>(
    `INSERT INTO objective
       (user_id, title, description, why_now, success_criteria, plan_link,
        review_cadence)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      userId,
      o.title,
      o.description,
      o.why_now,
      o.success_criteria,
      o.plan_link,
      o.review_cadence,
    ],
  );
  const id = objective.rows[0].id;

  // Segment 0's reason is the creation reason, why_now (docs/erd.md).
  await tx.query(
    `INSERT INTO plan_segment
       (objective_id, seq, schedule_mode, planned_weekdays, days_per_week,
        minutes_per_planned_day, start_date, end_date, reason)
     VALUES ($1, 0, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      o.schedule.mode,
      o.schedule.mode === "fixed"
        ? weekdaysToBitmask(o.schedule.planned_weekdays)
        : null,
      o.schedule.mode === "flexible" ? o.schedule.days_per_week : null,
      o.schedule.minutes_per_planned_day,
      o.starts_on,
      o.end_date,
      o.why_now,
    ],
  );

  // occurred_on is the day the user said it starts — never the server's today.
  await tx.query(
    `INSERT INTO status_event (objective_id, occurred_on, change)
     VALUES ($1, $2, 'created')`,
    [id, o.starts_on],
  );

  return id;
}

const OBJECTIVES_SQL = `
WITH obj AS (
  SELECT o.id, o.title, o.description, o.why_now, o.success_criteria,
         o.plan_link, o.review_cadence, o.from_parked_idea_id
  FROM objective o
  WHERE o.user_id = $1
    AND ($2::uuid IS NULL OR o.id = $2::uuid)
),
seg AS (
  SELECT s.objective_id,
    json_agg(json_build_object(
      'id', s.id,
      'seq', s.seq,
      'schedule_mode', s.schedule_mode,
      'planned_weekdays', s.planned_weekdays,
      'days_per_week', s.days_per_week,
      'minutes_per_planned_day', s.minutes_per_planned_day,
      'start_date', to_char(s.start_date, 'YYYY-MM-DD'),
      'end_date', to_char(s.end_date, 'YYYY-MM-DD'),
      'reason', s.reason,
      'created_by_review_id', s.created_by_review_id
    ) ORDER BY s.seq) AS segments
  FROM plan_segment s
  JOIN obj ON obj.id = s.objective_id
  GROUP BY s.objective_id
),
ev AS (
  SELECT e.objective_id,
    json_agg(json_build_object(
      'occurred_on', to_char(e.occurred_on, 'YYYY-MM-DD'),
      'change', e.change,
      'reason', e.reason
    ) ORDER BY e.occurred_on, e.recorded_at) AS status_events
  FROM status_event e
  JOIN obj ON obj.id = e.objective_id
  GROUP BY e.objective_id
),
per_day AS (
  SELECT e.objective_id, e.local_date, SUM(e.minutes)::int AS minutes
  FROM effort_entry e
  JOIN obj ON obj.id = e.objective_id
  GROUP BY e.objective_id, e.local_date
),
day AS (
  SELECT d.objective_id,
    json_agg(json_build_object(
      'local_date', to_char(d.local_date, 'YYYY-MM-DD'),
      'minutes', d.minutes
    ) ORDER BY d.local_date) AS daily_minutes
  FROM per_day d
  GROUP BY d.objective_id
)
SELECT
  obj.*,
  COALESCE(seg.segments, '[]'::json) AS segments,
  COALESCE(ev.status_events, '[]'::json) AS status_events,
  COALESCE(day.daily_minutes, '[]'::json) AS daily_minutes
FROM obj
LEFT JOIN seg ON seg.objective_id = obj.id
LEFT JOIN ev ON ev.objective_id = obj.id
LEFT JOIN day ON day.objective_id = obj.id
ORDER BY obj.title, obj.id
`;

/**
 * The objectives read — one query, whatever the number of objectives
 * (NFR-03's reason, applied to Keel's first list). The list, one objective
 * and its schedule grid all read this: facts only, with the minutes logged
 * summed per local date. Pass an id for one objective; an id that belongs to
 * someone else returns nothing, which the route turns into a 404 (NFR-10).
 */
export async function getObjectiveRows(
  userId: string,
  objectiveId: string | null,
): Promise<ObjectiveRow[]> {
  const result = await query<ObjectiveRow>(OBJECTIVES_SQL, [
    userId,
    objectiveId,
  ]);
  return result.rows;
}
