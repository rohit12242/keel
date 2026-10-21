/**
 * I-03 step 9 — notes on a parked idea (ERD revision 5, *Notes*; G3): the
 * same append-only list as an objective's, open in every state — a dropped
 * or taken idea still takes them. A note is not the drop reason, which stays
 * on the dropped verdict.
 *
 * No user_id: ownership travels through the idea (invariant 1).
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE parked_idea_note (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      parked_idea_id uuid NOT NULL REFERENCES parked_idea(id),
      written_on     date NOT NULL,
      text           text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
      recorded_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX parked_idea_note_idea_idx
      ON parked_idea_note (parked_idea_id, written_on, recorded_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE parked_idea_note;`);
};
