/**
 * I-03 step 2 — a review reflects in three fields, named for what they hold
 * (ERD revision 5, *Review*; G7).
 *
 *   what_went_right        → what_worked
 *   what_needs_improvement → what_changes_next (the one the next review quotes)
 *   (new)                  → what_got_in_the_way
 *
 * Dropped and added rather than renamed: an inline CHECK keeps its generated
 * name, so a rename would leave review_what_went_right_check guarding
 * what_worked. No backfill — there is no real data, and the down migration
 * restores the shape, not the text.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE review
      DROP COLUMN what_went_right,
      DROP COLUMN what_needs_improvement,
      ADD COLUMN what_worked text CHECK (char_length(what_worked) <= 4000),
      ADD COLUMN what_got_in_the_way text
        CHECK (char_length(what_got_in_the_way) <= 4000),
      ADD COLUMN what_changes_next text
        CHECK (char_length(what_changes_next) <= 4000);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE review
      DROP COLUMN what_worked,
      DROP COLUMN what_got_in_the_way,
      DROP COLUMN what_changes_next,
      ADD COLUMN what_went_right text CHECK (char_length(what_went_right) <= 4000),
      ADD COLUMN what_needs_improvement text
        CHECK (char_length(what_needs_improvement) <= 4000);
  `);
};
