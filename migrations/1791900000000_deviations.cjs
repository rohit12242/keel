/**
 * I-02 step 13 — deviations (ERD revision 4): `deviation_pattern`,
 * `deviation`, and `deviation_objective`, the objectives each one names.
 *
 * Ownership is proved by the schema, not trusted to the service (NFR-10):
 *
 *   - `deviation_objective` carries the user on both sides, and composite
 *     foreign keys tie (deviation_id, user_id) to the deviation and
 *     (objective_id, user_id) to the objective — so a row naming another
 *     user's objective cannot be written. Those keys need `objective` and
 *     `deviation` to be unique on (id, user_id), added here.
 *   - a deviation's pattern is the same user's, by the same device on
 *     (pattern_id, user_id). A null pattern — a genuine one-off — skips it.
 *
 * "At least one objective per deviation" the schema cannot check; the service
 * writes the deviation and its rows in one transaction.
 *
 * A verdict exists only on a chosen deviation, and only with the review that
 * gave it (invariant 12). `verdict_review_id` is a plain uuid until `review`
 * exists (step 21), which adds its foreign key.
 *
 * `tz` is stored beside `local_date` as on an effort entry (NFR-12): the
 * contract's DeviationWrite requires it. `description` on a pattern is the
 * contract's DeviationPattern.description.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE objective
      ADD CONSTRAINT objective_id_user_id_key UNIQUE (id, user_id);

    CREATE TYPE deviation_kind AS ENUM ('chosen', 'drifted');
    CREATE TYPE deviation_verdict AS ENUM ('worth_it', 'not_worth_it');

    CREATE TABLE deviation_pattern (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid NOT NULL REFERENCES "user"(id),
      name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
      description text CHECK (char_length(description) <= 2000),
      created_at  timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT deviation_pattern_id_user_id_key UNIQUE (id, user_id)
    );
    -- One name per user, whatever its case: "Planning instead of doing" and
    -- "planning instead of doing" are the same pattern.
    CREATE UNIQUE INDEX deviation_pattern_user_name_key
      ON deviation_pattern (user_id, lower(name));

    CREATE TABLE deviation (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id           uuid NOT NULL REFERENCES "user"(id),
      local_date        date NOT NULL,
      tz                text NOT NULL,
      kind              deviation_kind NOT NULL,
      what_happened     text NOT NULL CHECK (char_length(what_happened) BETWEEN 1 AND 2000),
      reasoning         text NOT NULL CHECK (char_length(reasoning) BETWEEN 1 AND 2000),
      did_instead       text CHECK (char_length(did_instead) <= 2000),
      minutes           integer NOT NULL CHECK (minutes BETWEEN 1 AND 1440),
      pattern_id        uuid,
      verdict           deviation_verdict,
      verdict_review_id uuid,
      recorded_at       timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT deviation_id_user_id_key UNIQUE (id, user_id),
      CONSTRAINT deviation_pattern_owned
        FOREIGN KEY (pattern_id, user_id)
        REFERENCES deviation_pattern (id, user_id),
      CONSTRAINT deviation_verdict_with_review
        CHECK ((verdict IS NULL) = (verdict_review_id IS NULL)),
      CONSTRAINT deviation_verdict_only_chosen
        CHECK (verdict IS NULL OR kind = 'chosen')
    );
    CREATE INDEX deviation_user_date_idx ON deviation (user_id, local_date);
    CREATE INDEX deviation_pattern_idx ON deviation (pattern_id);

    CREATE TABLE deviation_objective (
      deviation_id uuid NOT NULL,
      objective_id uuid NOT NULL,
      user_id      uuid NOT NULL,
      PRIMARY KEY (deviation_id, objective_id),
      CONSTRAINT deviation_objective_deviation_owned
        FOREIGN KEY (deviation_id, user_id) REFERENCES deviation (id, user_id),
      CONSTRAINT deviation_objective_objective_owned
        FOREIGN KEY (objective_id, user_id) REFERENCES objective (id, user_id)
    );
    CREATE INDEX deviation_objective_objective_idx
      ON deviation_objective (objective_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE deviation_objective;
    DROP TABLE deviation;
    DROP TABLE deviation_pattern;
    DROP TYPE deviation_verdict;
    DROP TYPE deviation_kind;
    ALTER TABLE objective DROP CONSTRAINT objective_id_user_id_key;
  `);
};
