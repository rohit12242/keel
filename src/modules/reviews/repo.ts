import { query, type Queryable } from "@/shared/db";
import {
  DEVIATION_COLUMNS,
  type DeviationRow,
} from "@/modules/deviations/repo";
import { IDEA_COLUMNS } from "@/modules/parking/repo";
import type { ObjectiveSegmentRow } from "@/modules/objectives/domain/rows";
import type { StatusEventRow } from "@/modules/objectives/domain/statusTimeline";
import type { IdeaRow } from "@/modules/parking/domain/parking";
import type { ReviewRow } from "./domain/assembleReview";
import type { ReviewEdit } from "./domain/reviewWrite";

/**
 * reviews/repo — the only file in this module with SQL (ADR-001). A review
 * has no user_id: it reaches its user through its objective, so every read
 * here starts from the caller's objective (NFR-10).
 */

export const REVIEW_COLUMNS = `
  r.id, r.objective_id, r.kind,
  to_char(r.period_start, 'YYYY-MM-DD') AS period_start,
  to_char(r.period_end, 'YYYY-MM-DD') AS period_end,
  r.status, r.previous_review_id, r.improvement_answer,
  r.improvement_answer_note, r.what_worked, r.what_got_in_the_way,
  r.what_changes_next,
  r.review_summary, r.criteria_assessment, r.criteria_verdict, r.outcome,
  to_char(r.saved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS saved_at`;

export type ObjectiveReviewFacts = {
  objective_id: string;
  user_tz: string;
  review_cadence: "weekly" | "monthly";
  segments: ObjectiveSegmentRow[];
  status_events: StatusEventRow[];
  daily_minutes: { local_date: string; minutes: number }[];
  reviews: ReviewRow[];
  deviations: DeviationRow[];
  ideas: IdeaRow[];
};

/**
 * Everything the reviews of one objective are computed from, in one query
 * (NFR-03): its plan, status, minutes per day, every review, the deviations
 * that name it, and its owner's parked ideas. Name the objective, or a review
 * of it; either way it must be the caller's, or this returns null.
 */
export async function getReviewFacts(
  q: Queryable | null,
  userId: string,
  by: { objectiveId: string } | { reviewId: string },
): Promise<ObjectiveReviewFacts | null> {
  const run = q ?? { query };
  const res = await run.query<ObjectiveReviewFacts>(
    `SELECT o.id AS objective_id, u.tz AS user_tz, o.review_cadence,
       COALESCE((
         SELECT json_agg(json_build_object(
           'id', s.id, 'seq', s.seq,
           'schedule_mode', s.schedule_mode,
           'planned_weekdays', s.planned_weekdays,
           'days_per_week', s.days_per_week,
           'minutes_per_planned_day', s.minutes_per_planned_day,
           'start_date', to_char(s.start_date, 'YYYY-MM-DD'),
           'end_date', to_char(s.end_date, 'YYYY-MM-DD'),
           'reason', s.reason,
           'created_by_review_id', s.created_by_review_id
         ) ORDER BY s.seq)
         FROM plan_segment s WHERE s.objective_id = o.id
       ), '[]'::json) AS segments,
       COALESCE((
         SELECT json_agg(json_build_object(
           'occurred_on', to_char(e.occurred_on, 'YYYY-MM-DD'),
           'change', e.change
         ) ORDER BY e.occurred_on, e.recorded_at)
         FROM status_event e WHERE e.objective_id = o.id
       ), '[]'::json) AS status_events,
       COALESCE((
         SELECT json_agg(json_build_object(
           'local_date', to_char(d.local_date, 'YYYY-MM-DD'),
           'minutes', d.minutes
         ) ORDER BY d.local_date)
         FROM (
           SELECT ee.local_date, SUM(ee.minutes)::int AS minutes
           FROM effort_entry ee WHERE ee.objective_id = o.id
           GROUP BY ee.local_date
         ) d
       ), '[]'::json) AS daily_minutes,
       COALESCE((
         SELECT json_agg(x ORDER BY x.period_start) FROM (
           SELECT ${REVIEW_COLUMNS} FROM review r WHERE r.objective_id = o.id
         ) x
       ), '[]'::json) AS reviews,
       COALESCE((
         SELECT json_agg(x ORDER BY x.local_date) FROM (
           SELECT ${DEVIATION_COLUMNS}
           FROM deviation d
           LEFT JOIN deviation_pattern p ON p.id = d.pattern_id
           WHERE EXISTS (
             SELECT 1 FROM deviation_objective dobj
             WHERE dobj.deviation_id = d.id AND dobj.objective_id = o.id)
         ) x
       ), '[]'::json) AS deviations,
       COALESCE((
         SELECT json_agg(x ORDER BY x.caught_on) FROM (
           SELECT ${IDEA_COLUMNS} FROM parked_idea i WHERE i.user_id = o.user_id
         ) x
       ), '[]'::json) AS ideas
     FROM objective o
     JOIN "user" u ON u.id = o.user_id
     WHERE o.user_id = $1
       AND o.id = COALESCE(
         $2::uuid,
         (SELECT r.objective_id FROM review r WHERE r.id = $3::uuid))`,
    [
      userId,
      "objectiveId" in by ? by.objectiveId : null,
      "reviewId" in by ? by.reviewId : null,
    ],
  );
  return res.rows[0] ?? null;
}

/**
 * A new draft for a window. If another request created it first, the unique
 * key keeps one row and this returns that one, so two "Start review" clicks
 * open the same draft.
 */
export async function insertDraft(
  objectiveId: string,
  w: { kind: ReviewRow["kind"]; period_start: string; period_end: string },
): Promise<{ id: string; created: boolean }> {
  const res = await query<{ id: string }>(
    `INSERT INTO review (objective_id, kind, period_start, period_end)
     VALUES ($1, $2, $3::date, $4::date)
     ON CONFLICT ON CONSTRAINT review_one_per_period DO NOTHING
     RETURNING id`,
    [objectiveId, w.kind, w.period_start, w.period_end],
  );
  if (res.rows[0]) return { id: res.rows[0].id, created: true };
  const existing = await query<{ id: string }>(
    `SELECT id FROM review
     WHERE objective_id = $1 AND period_start = $2::date AND period_end = $3::date`,
    [objectiveId, w.period_start, w.period_end],
  );
  return { id: existing.rows[0].id, created: false };
}

/**
 * The caller's review, locked for the rest of the transaction so an
 * autosave, a verdict, a save and a discard cannot interleave. Null when it
 * is not theirs.
 */
export async function lockReview(
  tx: Queryable,
  userId: string,
  reviewId: string,
): Promise<ReviewRow | null> {
  const res = await tx.query<ReviewRow>(
    `SELECT ${REVIEW_COLUMNS}
     FROM review r JOIN objective o ON o.id = r.objective_id
     WHERE r.id = $2 AND o.user_id = $1
     FOR UPDATE OF r`,
    [userId, reviewId],
  );
  return res.rows[0] ?? null;
}

/** Only these columns are written; the names are fixed, never from the body. */
const EDITABLE: (keyof ReviewEdit)[] = [
  "improvement_answer",
  "improvement_answer_note",
  "what_worked",
  "what_got_in_the_way",
  "what_changes_next",
  "review_summary",
  "criteria_assessment",
  "criteria_verdict",
  "outcome",
];

export async function updateReviewAnswers(
  tx: Queryable,
  reviewId: string,
  edit: ReviewEdit,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [reviewId];
  for (const column of EDITABLE) {
    if (!(column in edit)) continue;
    params.push(edit[column]);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return;
  await tx.query(`UPDATE review SET ${sets.join(", ")} WHERE id = $1`, params);
}

/**
 * Discard a draft. Verdicts it gave were never saved, so they go with it; the
 * deviations themselves stay (NFR-01). Nothing else can point at a draft.
 */
export async function deleteDraft(
  tx: Queryable,
  reviewId: string,
): Promise<void> {
  await tx.query(
    `UPDATE deviation SET verdict = NULL, verdict_review_id = NULL
     WHERE verdict_review_id = $1`,
    [reviewId],
  );
  await tx.query(`DELETE FROM review WHERE id = $1 AND status = 'draft'`, [
    reviewId,
  ]);
}

/** The caller's deviation, locked for the verdict. Null when it is not theirs. */
export async function lockDeviation(
  tx: Queryable,
  userId: string,
  deviationId: string,
): Promise<DeviationRow | null> {
  await tx.query(
    `SELECT 1 FROM deviation WHERE id = $2 AND user_id = $1 FOR UPDATE`,
    [userId, deviationId],
  );
  const res = await tx.query<DeviationRow>(
    `SELECT ${DEVIATION_COLUMNS}
     FROM deviation d LEFT JOIN deviation_pattern p ON p.id = d.pattern_id
     WHERE d.id = $2 AND d.user_id = $1`,
    [userId, deviationId],
  );
  return res.rows[0] ?? null;
}

export async function setDeviationVerdict(
  tx: Queryable,
  deviationId: string,
  verdict: string,
  reviewId: string,
): Promise<DeviationRow> {
  await tx.query(
    `UPDATE deviation SET verdict = $2, verdict_review_id = $3 WHERE id = $1`,
    [deviationId, verdict, reviewId],
  );
  const res = await tx.query<DeviationRow>(
    `SELECT ${DEVIATION_COLUMNS}
     FROM deviation d LEFT JOIN deviation_pattern p ON p.id = d.pattern_id
     WHERE d.id = $1`,
    [deviationId],
  );
  return res.rows[0];
}

/** The draft becomes the record, answering `previousReviewId`. */
export async function markSaved(
  tx: Queryable,
  reviewId: string,
  previousReviewId: string | null,
): Promise<void> {
  await tx.query(
    `UPDATE review
     SET status = 'saved', saved_at = now(), previous_review_id = $2
     WHERE id = $1 AND status = 'draft'`,
    [reviewId, previousReviewId],
  );
}
