/**
 * I-02 step 17 — the parking lot: `parked_idea` and its append-only verdict
 * history, `parked_idea_verdict` (ERD revision 2, invariant 13).
 *
 *   - `locked_until` is stored: set once when parked, never moved
 *     (docs/domain/parking-lock.md). The current verdict is not stored on the
 *     idea — it is the latest verdict row.
 *   - `objective.from_parked_idea_id` gets its foreign key at last, on
 *     (from_parked_idea_id, user_id), so an objective can only be started from
 *     its own user's idea. It is unique: one idea becomes at most one
 *     objective.
 *   - An idea is taken at most once: a partial unique index on the `taken`
 *     row. Taking is final (the contract's 409).
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE parked_idea (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      uuid NOT NULL REFERENCES "user"(id),
      idea         text NOT NULL CHECK (char_length(idea) BETWEEN 1 AND 300),
      why          text NOT NULL CHECK (char_length(why) BETWEEN 1 AND 2000),
      caught_on    date NOT NULL,
      locked_until date NOT NULL CHECK (locked_until >= caught_on),
      recorded_at  timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT parked_idea_id_user_id_key UNIQUE (id, user_id)
    );
    CREATE INDEX parked_idea_user_idx ON parked_idea (user_id, caught_on);

    CREATE TYPE parked_verdict AS ENUM ('parked', 'taken', 'dropped');

    CREATE TABLE parked_idea_verdict (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      parked_idea_id uuid NOT NULL REFERENCES parked_idea(id),
      verdict        parked_verdict NOT NULL,
      note           text CHECK (char_length(note) <= 2000),
      occurred_on    date NOT NULL,
      recorded_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX parked_idea_verdict_idea_idx
      ON parked_idea_verdict (parked_idea_id, occurred_on, recorded_at);
    CREATE UNIQUE INDEX parked_idea_verdict_one_taken_idx
      ON parked_idea_verdict (parked_idea_id) WHERE verdict = 'taken';

    ALTER TABLE objective
      ADD CONSTRAINT objective_from_parked_idea_owned
        FOREIGN KEY (from_parked_idea_id, user_id)
        REFERENCES parked_idea (id, user_id),
      ADD CONSTRAINT objective_from_parked_idea_key
        UNIQUE (from_parked_idea_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE objective
      DROP CONSTRAINT objective_from_parked_idea_key,
      DROP CONSTRAINT objective_from_parked_idea_owned;
    DROP TABLE parked_idea_verdict;
    DROP TYPE parked_verdict;
    DROP TABLE parked_idea;
  `);
};
