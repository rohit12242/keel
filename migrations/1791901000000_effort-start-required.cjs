/**
 * I-03 step 12 — every effort entry has a start (ERD invariant 18; G29). With
 * `minutes` it is the entry's span, and no two of a user's spans on one day
 * overlap. That rule is not here: `effort_entry` has no user_id (invariant 1),
 * so an exclusion constraint cannot see a user's other objectives. The write
 * path checks it under a lock on the user's row.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(
    `ALTER TABLE effort_entry ALTER COLUMN occurred_at_local SET NOT NULL;`,
  );
};

exports.down = (pgm) => {
  pgm.sql(
    `ALTER TABLE effort_entry ALTER COLUMN occurred_at_local DROP NOT NULL;`,
  );
};
