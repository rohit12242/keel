/**
 * I-14 step 3 — two facts a segment carries from now on (ERD, plan_segment;
 * ADR-008, the two I-14 amendments).
 *
 * - `plans_from`: the first day the segment plans. `start_date` for every
 *   existing row; later than it only for an extension made after the plan had
 *   ended (G48). A row CHECK keeps it inside the segment — not a trigger: the
 *   contiguity trigger stays the only one.
 * - `review_cadence`: the cadence the segment's review windows are cut by.
 *   Every existing segment takes its objective's, so no window moves.
 *
 * Both are additive and backfilled. Once released, roll back the image, not
 * this migration: down drops the facts a late extension has written.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // The backfill fires the deferred contiguity trigger; run its checks now,
  // or the ALTER after it fails with "pending trigger events".
  pgm.sql(`
    SET CONSTRAINTS ALL IMMEDIATE;

    ALTER TABLE plan_segment
      ADD COLUMN plans_from date,
      ADD COLUMN review_cadence review_cadence;

    UPDATE plan_segment s
       SET plans_from = s.start_date,
           review_cadence = o.review_cadence
      FROM objective o
     WHERE o.id = s.objective_id;

    ALTER TABLE plan_segment
      ALTER COLUMN plans_from SET NOT NULL,
      ALTER COLUMN review_cadence SET NOT NULL,
      ADD CONSTRAINT plan_segment_plans_from_in_range
        CHECK (start_date <= plans_from AND plans_from <= end_date);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE plan_segment
      DROP CONSTRAINT plan_segment_plans_from_in_range,
      DROP COLUMN review_cadence,
      DROP COLUMN plans_from;
  `);
};
