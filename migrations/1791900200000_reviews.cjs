/**
 * I-02 step 21 — reviews (ERD, *Review*).
 *
 *   - One review per objective and period: draft and saved are the same row,
 *     so the unique key holds "at most one draft" and "never a second saved
 *     review" at once (invariant 14).
 *   - Plan-end fields — criteria_assessment, criteria_verdict, outcome — are
 *     null on every weekly and monthly review (invariant 8).
 *   - saved_at is set exactly when the review is saved.
 *   - No figure is stored (NFR-09). Nor is `due_on`: a window's period_end is
 *     its due date (docs/domain/review-windows.md), so storing it would be a
 *     second copy of the same date. The contract's due_on is computed.
 *   - The two plain-uuid columns waiting for this table get their foreign
 *     keys: plan_segment.created_by_review_id and deviation.verdict_review_id.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE review_kind AS ENUM ('weekly', 'monthly', 'plan_end');
    CREATE TYPE review_status AS ENUM ('draft', 'saved');
    CREATE TYPE improvement_answer AS ENUM ('yes', 'partly', 'no');
    CREATE TYPE criteria_verdict AS ENUM ('met', 'partly_met', 'not_met');
    CREATE TYPE review_outcome AS ENUM ('continued', 'completed', 'paused', 'ended');

    CREATE TABLE review (
      id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      objective_id            uuid NOT NULL REFERENCES objective(id),
      kind                    review_kind NOT NULL,
      period_start            date NOT NULL,
      period_end              date NOT NULL,
      status                  review_status NOT NULL DEFAULT 'draft',
      previous_review_id      uuid REFERENCES review(id),
      improvement_answer      improvement_answer,
      improvement_answer_note text CHECK (char_length(improvement_answer_note) <= 2000),
      what_went_right         text CHECK (char_length(what_went_right) <= 4000),
      what_needs_improvement  text CHECK (char_length(what_needs_improvement) <= 4000),
      review_summary          text CHECK (char_length(review_summary) <= 1000),
      criteria_assessment     text CHECK (char_length(criteria_assessment) <= 2000),
      criteria_verdict        criteria_verdict,
      outcome                 review_outcome,
      saved_at                timestamptz,
      created_at              timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT review_one_per_period UNIQUE (objective_id, period_start, period_end),
      CONSTRAINT review_period_in_order CHECK (period_start <= period_end),
      CONSTRAINT review_plan_end_fields_only_on_plan_end CHECK (
        kind = 'plan_end'
        OR (criteria_assessment IS NULL AND criteria_verdict IS NULL AND outcome IS NULL)
      ),
      CONSTRAINT review_saved_at_when_saved CHECK (
        (status = 'saved') = (saved_at IS NOT NULL)
      )
    );
    CREATE INDEX review_objective_idx ON review (objective_id, period_end);

    ALTER TABLE plan_segment
      ADD CONSTRAINT plan_segment_created_by_review_fkey
        FOREIGN KEY (created_by_review_id) REFERENCES review(id);
    ALTER TABLE deviation
      ADD CONSTRAINT deviation_verdict_review_fkey
        FOREIGN KEY (verdict_review_id) REFERENCES review(id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE deviation DROP CONSTRAINT deviation_verdict_review_fkey;
    ALTER TABLE plan_segment DROP CONSTRAINT plan_segment_created_by_review_fkey;
    DROP TABLE review;
    DROP TYPE review_outcome;
    DROP TYPE criteria_verdict;
    DROP TYPE improvement_answer;
    DROP TYPE review_status;
    DROP TYPE review_kind;
  `);
};
