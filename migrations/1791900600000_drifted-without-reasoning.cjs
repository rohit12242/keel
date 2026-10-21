/**
 * I-03 step 5 — a drifted deviation has no reasoning; a chosen one must
 * (G5). Nobody chose a drift, so there is no "why it was worth it" to keep.
 * The existing length CHECK stays: a null passes it.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE deviation ALTER COLUMN reasoning DROP NOT NULL;
    ALTER TABLE deviation
      ADD CONSTRAINT deviation_reasoning_only_chosen
        CHECK ((kind = 'chosen') = (reasoning IS NOT NULL));
  `);
};

exports.down = (pgm) => {
  // Fails if a drifted deviation exists, which is correct: it has no
  // reasoning to restore.
  pgm.sql(`
    ALTER TABLE deviation DROP CONSTRAINT deviation_reasoning_only_chosen;
    ALTER TABLE deviation ALTER COLUMN reasoning SET NOT NULL;
  `);
};
