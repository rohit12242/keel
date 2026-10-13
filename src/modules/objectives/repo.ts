import { query, type Queryable } from "@/shared/db";
import type { NewObjective } from "./domain/validateObjectiveWrite";
import { weekdaysToBitmask } from "./domain/weekdays";
import type { ListRow } from "./domain/rows";
import type { StatusChange, StatusEventRow } from "./domain/statusTimeline";

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
        review_cadence, from_parked_idea_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      userId,
      o.title,
      o.description,
      o.why_now,
      o.success_criteria,
      o.plan_link,
      o.review_cadence,
      o.from_parked_idea_id,
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
         o.plan_link, o.review_cadence, o.from_parked_idea_id,
         u.tz AS user_tz
  FROM objective o
  JOIN "user" u ON u.id = o.user_id
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
): Promise<ListRow[]> {
  const result = await query<ListRow>(OBJECTIVES_SQL, [userId, objectiveId]);
  return result.rows;
}

/**
 * The caller's objective's status history, with the objective row locked for
 * the rest of the transaction, so two changes cannot both be checked against
 * the same history and both appended. Null when the objective is not theirs.
 */
export async function lockStatusHistory(
  tx: Queryable,
  userId: string,
  objectiveId: string,
): Promise<StatusEventRow[] | null> {
  const owned = await tx.query(
    `SELECT 1 FROM objective WHERE id = $2 AND user_id = $1 FOR UPDATE`,
    [userId, objectiveId],
  );
  if (owned.rowCount === 0) return null;
  const events = await tx.query<StatusEventRow>(
    `SELECT to_char(occurred_on, 'YYYY-MM-DD') AS occurred_on, change
     FROM status_event WHERE objective_id = $1
     ORDER BY occurred_on, recorded_at`,
    [objectiveId],
  );
  return events.rows;
}

/** Append one status event. Nothing ever updates or deletes one. */
export async function insertStatusEvent(
  tx: Queryable,
  objectiveId: string,
  change: StatusChange,
  occurredOn: string,
  reason: string | null,
): Promise<{
  occurred_on: string;
  change: StatusChange;
  reason: string | null;
}> {
  const res = await tx.query<{
    occurred_on: string;
    change: StatusChange;
    reason: string | null;
  }>(
    `INSERT INTO status_event (objective_id, occurred_on, change, reason)
     VALUES ($1, $2::date, $3, $4)
     RETURNING to_char(occurred_on, 'YYYY-MM-DD') AS occurred_on, change, reason`,
    [objectiveId, occurredOn, change, reason],
  );
  return res.rows[0];
}
