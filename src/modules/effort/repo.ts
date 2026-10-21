import { query, type Queryable } from "@/shared/db";
import type { EffortEntryWrite } from "@/shared/contract";
import type { EffortEdit } from "./domain/validateEffortEdit";
import type { EffortEntryFact } from "./domain/effortMonth";
import type { PlanSegmentRow } from "@/modules/objectives/domain/segmentRows";
import type { StatusEventRow } from "@/modules/objectives/domain/statusTimeline";

/**
 * effort/repo — the only file in this module with SQL (ADR-001).
 */

export type ObjectiveForEffort = {
  segments: PlanSegmentRow[];
  status_events: StatusEventRow[];
};

/** The facts the objective rules read, for the objective aliased `o`. */
const OBJECTIVE_FACTS = `
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
       ), '[]'::json) AS status_events`;

const ENTRY_COLUMNS = (alias: string) => `
       ${alias}.id, ${alias}.objective_id,
       to_char(${alias}.local_date, 'YYYY-MM-DD') AS local_date,
       ${alias}.tz, ${alias}.minutes, ${alias}.note, ${alias}.link,
       to_char(${alias}.occurred_at_local, 'HH24:MI') AS occurred_at_local,
       to_char(${alias}.logged_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS logged_at`;

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
    `SELECT ${OBJECTIVE_FACTS}
     FROM objective o
     WHERE o.id = $2 AND o.user_id = $1`,
    [userId, objectiveId],
  );
  return res.rows[0] ?? null;
}

/** A row as returned by the insert (link may be null). */
export type EffortEntryRow = {
  id: string;
  objective_id: string;
  local_date: string;
  tz: string;
  minutes: number;
  note: string;
  occurred_at_local: string;
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
  q: Queryable,
  objectiveId: string,
  w: EffortEntryWrite,
): Promise<EffortEntryRow> {
  const res = await q.query<EffortEntryRow>(
    `INSERT INTO effort_entry
       (objective_id, local_date, occurred_at_local, tz, minutes, note, link)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7)
     RETURNING ${ENTRY_COLUMNS("effort_entry")}`,
    [
      objectiveId,
      w.local_date,
      w.occurred_at_local,
      w.tz,
      w.minutes,
      w.note,
      w.link ?? null,
    ],
  );
  return res.rows[0];
}

/**
 * An entry, with the facts its objective's rules need, if the entry belongs
 * to one of the caller's objectives. `effort_entry` has no user_id (ERD
 * invariant 1): ownership is the join through `objective`. One query.
 */
export async function getEntryForEdit(
  userId: string,
  entryId: string,
): Promise<(EffortEntryRow & ObjectiveForEffort) | null> {
  const res = await query<EffortEntryRow & ObjectiveForEffort>(
    `SELECT ${ENTRY_COLUMNS("ee")}, ${OBJECTIVE_FACTS}
     FROM effort_entry ee
     JOIN objective o ON o.id = ee.objective_id
     WHERE ee.id = $2 AND o.user_id = $1`,
    [userId, entryId],
  );
  return res.rows[0] ?? null;
}

/** Only these columns can change; the keys are fixed, never from the body. */
const EDITABLE: Record<keyof EffortEdit, string> = {
  minutes: "minutes = $%",
  occurred_at_local: "occurred_at_local = $%::time",
  note: "note = $%",
  link: "link = $%",
};

/** Apply an edit already checked by the domain and by ownership. */
export async function updateEffortEntry(
  q: Queryable,
  entryId: string,
  edit: EffortEdit,
): Promise<EffortEntryRow> {
  const sets: string[] = [];
  const params: unknown[] = [entryId];
  for (const key of Object.keys(EDITABLE) as (keyof EffortEdit)[]) {
    if (edit[key] === undefined) continue;
    params.push(edit[key]);
    sets.push(EDITABLE[key].replace("%", String(params.length)));
  }
  const res = await q.query<EffortEntryRow>(
    `UPDATE effort_entry SET ${sets.join(", ")}
     WHERE id = $1
     RETURNING ${ENTRY_COLUMNS("effort_entry")}`,
    params,
  );
  return res.rows[0];
}

/** One of the user's entries on a day, as the overlap rule reads it. */
export type DayEntrySpan = {
  id: string;
  occurred_at_local: string;
  minutes: number;
};

/**
 * The caller's entries on `localDate`, across every objective, with the
 * user's row locked for the rest of the transaction. Two writes for one user
 * are then checked one after the other, never both against the same day —
 * the schema cannot hold "no overlap" itself, because `effort_entry` reaches
 * its user only through `objective` (invariant 1, invariant 18). `exceptId`
 * leaves out the entry being edited.
 */
export async function lockUserDay(
  tx: Queryable,
  userId: string,
  localDate: string,
  exceptId: string | null,
): Promise<DayEntrySpan[]> {
  await tx.query(`SELECT 1 FROM "user" WHERE id = $1 FOR UPDATE`, [userId]);
  const res = await tx.query<DayEntrySpan>(
    `SELECT ee.id, to_char(ee.occurred_at_local, 'HH24:MI') AS occurred_at_local,
            ee.minutes
     FROM effort_entry ee
     JOIN objective o ON o.id = ee.objective_id
     WHERE o.user_id = $1 AND ee.local_date = $2::date
       AND ($3::uuid IS NULL OR ee.id <> $3::uuid)
     ORDER BY ee.occurred_at_local`,
    [userId, localDate, exceptId],
  );
  return res.rows;
}

/** Effort entries are the one thing Keel deletes (NFR-01). */
export async function deleteEffortEntry(entryId: string): Promise<void> {
  await query(`DELETE FROM effort_entry WHERE id = $1`, [entryId]);
}

export type EffortMonthFacts = ObjectiveForEffort & {
  /** The caller's zone, to read today in. */
  tz: string;
  /** Every entry, in the order the sessions happened. */
  entries: EffortEntryFact[];
};

/**
 * Everything the Effort tab computes from, in one query (NFR-03): the
 * objective's segments and status events, the caller's zone, and every entry.
 * Null when the objective is not the caller's.
 */
export async function getEffortMonthFacts(
  userId: string,
  objectiveId: string,
): Promise<EffortMonthFacts | null> {
  const res = await query<EffortMonthFacts>(
    `SELECT ${OBJECTIVE_FACTS},
       u.tz,
       COALESCE((
         SELECT json_agg(json_build_object(
           'local_date', to_char(ee.local_date, 'YYYY-MM-DD'),
           'minutes', ee.minutes,
           'note', ee.note
         ) ORDER BY ee.local_date, ee.occurred_at_local NULLS LAST, ee.logged_at)
         FROM effort_entry ee WHERE ee.objective_id = o.id
       ), '[]'::json) AS entries
     FROM objective o
     JOIN "user" u ON u.id = o.user_id
     WHERE o.id = $2 AND o.user_id = $1`,
    [userId, objectiveId],
  );
  return res.rows[0] ?? null;
}
