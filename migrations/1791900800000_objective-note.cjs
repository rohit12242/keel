/**
 * I-03 step 8 — notes on an objective (ERD revision 5, *Notes*; G2): an
 * append-only list, each dated, open in every state — a completed or ended
 * objective still takes them.
 *
 * No user_id: ownership travels through the objective (invariant 1), so
 * every read and write joins through `objective` to the caller.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE objective_note (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      objective_id uuid NOT NULL REFERENCES objective(id),
      written_on   date NOT NULL,
      text         text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
      recorded_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX objective_note_objective_idx
      ON objective_note (objective_id, written_on, recorded_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE objective_note;`);
};
