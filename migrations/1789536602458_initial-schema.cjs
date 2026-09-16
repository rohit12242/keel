/**
 * W3-12 — first migration. Five tables from docs/erd.md:
 * user, objective, plan_segment, plan_slot, effort_entry.
 *
 * Only these five. deviation, review, parked_idea, status_event and the rest
 * of the ERD are later stories. Columns that would reference not-yet-created
 * tables (objective.from_parked_idea_id, plan_segment.created_by_review_id) are
 * added as plain uuid columns now; their FK constraints land with those tables.
 *
 * NFR-12 (kept half): local_date is a real DATE, logged_at is timestamptz, tz
 * is text — three separate columns, never one derived from another.
 * NFR-09: no stored aggregate — nothing computed gets a column.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS citext;
    CREATE EXTENSION IF NOT EXISTS btree_gist;

    CREATE TYPE review_cadence AS ENUM ('weekly', 'monthly');
    CREATE TYPE objective_status AS ENUM ('active', 'paused', 'completed', 'ended');
    CREATE TYPE schedule_mode AS ENUM ('fixed', 'flexible');
    CREATE TYPE period_kind AS ENUM ('day', 'week');

    -- user. "user" is a reserved word, hence quoted everywhere it appears.
    -- password_hash is nullable until auth (E-06); no credential is invented now.
    CREATE TABLE "user" (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email         citext NOT NULL UNIQUE,
      password_hash text,
      tz            text NOT NULL
    );

    CREATE TABLE objective (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id             uuid NOT NULL REFERENCES "user"(id),
      title               text NOT NULL,
      description         text,
      why_now             text NOT NULL,
      success_criteria    text NOT NULL,
      plan_link           text,
      review_cadence      review_cadence NOT NULL,
      status              objective_status NOT NULL DEFAULT 'active',
      from_parked_idea_id uuid  -- FK added with parked_idea (later story)
    );
    CREATE INDEX objective_user_id_idx ON objective (user_id);

    CREATE TABLE plan_segment (
      id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      objective_id            uuid NOT NULL REFERENCES objective(id),
      seq                     smallint NOT NULL,
      schedule_mode           schedule_mode NOT NULL,
      planned_weekdays        smallint,  -- bitmask Mon..Sun; null when flexible
      days_per_week           smallint,  -- null when fixed
      minutes_per_planned_day integer NOT NULL,
      start_date              date NOT NULL,
      end_date                date NOT NULL,
      reason                  text NOT NULL,           -- invariant 5
      created_by_review_id    uuid,                    -- FK added with review (later)
      CONSTRAINT plan_segment_seq_unique UNIQUE (objective_id, seq),
      CONSTRAINT plan_segment_dates CHECK (end_date >= start_date),
      -- invariant re: mode determines which schedule columns are set
      CONSTRAINT plan_segment_mode CHECK (
        (schedule_mode = 'fixed'    AND planned_weekdays IS NOT NULL AND days_per_week IS NULL)
        OR
        (schedule_mode = 'flexible' AND days_per_week   IS NOT NULL AND planned_weekdays IS NULL)
      ),
      -- invariant 4: segments of one objective never overlap
      CONSTRAINT plan_segment_no_overlap EXCLUDE USING gist (
        objective_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
      )
    );

    CREATE TABLE plan_slot (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_segment_id uuid NOT NULL REFERENCES plan_segment(id),
      period_kind     period_kind NOT NULL,
      period_start    date NOT NULL,
      period_end      date NOT NULL,
      target_minutes  integer NOT NULL,
      target_days     smallint,  -- week slots only
      CONSTRAINT plan_slot_unique UNIQUE (plan_segment_id, period_start, period_kind),
      -- invariant 9: a day slot is one date with no target_days; a week slot carries target_days
      CONSTRAINT plan_slot_period CHECK (
        (period_kind = 'day'  AND period_start = period_end AND target_days IS NULL)
        OR
        (period_kind = 'week' AND target_days IS NOT NULL)
      )
    );
    CREATE INDEX plan_slot_segment_idx ON plan_slot (plan_segment_id);
    CREATE INDEX plan_slot_period_idx ON plan_slot (period_start, period_end);

    CREATE TABLE effort_entry (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      objective_id      uuid NOT NULL REFERENCES objective(id),
      local_date        date NOT NULL,           -- the day meant; never derived (NFR-12)
      occurred_at_local time,
      logged_at         timestamptz NOT NULL DEFAULT now(),
      tz                text NOT NULL,
      minutes           integer NOT NULL,
      note              text NOT NULL,
      link              text,
      CONSTRAINT effort_entry_minutes CHECK (minutes BETWEEN 1 AND 1440)
    );
    CREATE INDEX effort_entry_objective_date_idx ON effort_entry (objective_id, local_date);
    CREATE INDEX effort_entry_local_date_idx ON effort_entry (local_date);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS effort_entry;
    DROP TABLE IF EXISTS plan_slot;
    DROP TABLE IF EXISTS plan_segment;
    DROP TABLE IF EXISTS objective;
    DROP TABLE IF EXISTS "user";
    DROP TYPE IF EXISTS period_kind;
    DROP TYPE IF EXISTS schedule_mode;
    DROP TYPE IF EXISTS objective_status;
    DROP TYPE IF EXISTS review_cadence;
  `);
};
