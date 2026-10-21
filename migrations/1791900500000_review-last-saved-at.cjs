/**
 * I-03 step 4 — a draft says when it was last saved (G10): "Draft saved ·
 * 5 Sep, 18:40". Set by every autosave and by Save draft; null until the
 * first save. Saving the review leaves it alone — saved_at records that.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE review ADD COLUMN last_saved_at timestamptz;`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE review DROP COLUMN last_saved_at;`);
};
