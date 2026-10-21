/**
 * I-03 step 6 — the parking lot as the approved design has it (ERD revision
 * 5, invariant 13; G4).
 *
 *   - `approved` is a verdict, between parked and taken. Only an approved idea
 *     can be taken (enforced by the service, step 7).
 *   - Dropped and taken are final: at most one final row per idea, by a
 *     partial unique index that replaces the taken-only one. "Nothing follows
 *     a final row" is the service's rule, checked under the idea's row lock.
 *   - Dropping says why: a dropped row carries a non-empty note. The IS NOT
 *     NULL is needed — a CHECK that evaluates to null passes.
 *
 * ADD VALUE runs inside the transaction on Postgres 18, but the new value
 * cannot be used in the same one, so nothing below names 'approved'.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TYPE parked_verdict ADD VALUE 'approved' BEFORE 'taken';

    DROP INDEX parked_idea_verdict_one_taken_idx;
    CREATE UNIQUE INDEX parked_idea_verdict_one_final_idx
      ON parked_idea_verdict (parked_idea_id)
      WHERE verdict IN ('taken', 'dropped');

    ALTER TABLE parked_idea_verdict
      ADD CONSTRAINT parked_idea_verdict_dropped_says_why
        CHECK (
          verdict <> 'dropped' OR (note IS NOT NULL AND char_length(note) >= 1)
        );
  `);
};

exports.down = (pgm) => {
  // A value cannot be removed from an enum: recreate the type without it.
  // Fails if any verdict is approved, or an idea has two dropped rows —
  // both are rows the old rules could not hold.
  pgm.sql(`
    ALTER TABLE parked_idea_verdict
      DROP CONSTRAINT parked_idea_verdict_dropped_says_why;
    DROP INDEX parked_idea_verdict_one_final_idx;

    ALTER TYPE parked_verdict RENAME TO parked_verdict_old;
    CREATE TYPE parked_verdict AS ENUM ('parked', 'taken', 'dropped');
    ALTER TABLE parked_idea_verdict
      ALTER COLUMN verdict TYPE parked_verdict
      USING verdict::text::parked_verdict;
    DROP TYPE parked_verdict_old;

    CREATE UNIQUE INDEX parked_idea_verdict_one_taken_idx
      ON parked_idea_verdict (parked_idea_id) WHERE verdict = 'taken';
  `);
};
