/**
 * I-03 step 3 — "Did last week's change work?" gains a fourth answer,
 * not_tried (G6). Didn't try it is a different finding from didn't work, and
 * the next review must be able to tell them apart.
 *
 * ADD VALUE runs inside the migration's transaction on Postgres 18; the new
 * value is not used here, which is the one thing that would fail.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE improvement_answer ADD VALUE 'not_tried';`);
};

exports.down = (pgm) => {
  // A value cannot be removed from an enum: recreate the type without it.
  // Fails if any review still holds not_tried, which is correct.
  pgm.sql(`
    ALTER TYPE improvement_answer RENAME TO improvement_answer_old;
    CREATE TYPE improvement_answer AS ENUM ('yes', 'partly', 'no');
    ALTER TABLE review
      ALTER COLUMN improvement_answer TYPE improvement_answer
      USING improvement_answer::text::improvement_answer;
    DROP TYPE improvement_answer_old;
  `);
};
