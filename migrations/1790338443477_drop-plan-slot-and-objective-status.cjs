/**
 * W4-30 — the CONTRACT step of expand-migrate-contract (ADR-004).
 *
 *   W4-10 expanded: status_event exists and every objective has a created event.
 *   W4-29 migrated: Today and the effort write compute the slot and read the
 *                   status from status_event; nothing reads or writes plan_slot
 *                   or objective.status.
 *   W4-30 contracts: this. Drops what the readers left behind, so the schema
 *                   matches ERD revision 3 (ADR-008).
 *
 * Safe because nothing depends on them — checked, not assumed, against the
 * live catalog before this was written: objective_status is used by
 * objective.status alone and period_kind by plan_slot.period_kind alone; no
 * view, function or foreign key refers to plan_slot. See the handover.
 *
 * Order matters: the column and the table go before the types they use.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    -- Slots are values now, computed by generateSlots from the segment and the
    -- status events (ADR-008). The table's indexes and constraints go with it.
    DROP TABLE plan_slot;

    -- The status is the latest status event (ERD invariant 16).
    ALTER TABLE objective DROP COLUMN status;

    -- Nothing else uses either type. Plain DROP TYPE, not CASCADE: if something
    -- had started depending on one, this migration should fail rather than
    -- quietly take the dependent with it.
    DROP TYPE objective_status;
    DROP TYPE period_kind;
  `);
};

exports.down = (pgm) => {
  // Recreates W3-12's shape exactly: the same types, columns, NOT NULLs,
  // defaults, constraint names and index names
  // (migrations/1789536602458_initial-schema.cjs).
  //
  // Two things it cannot restore, and does not pretend to:
  //   - COLUMN ORDER. ADD COLUMN always appends, so objective.status comes back
  //     after from_parked_idea_id rather than before it. Nothing reads columns
  //     by position.
  //   - THE ROWS. plan_slot comes back empty, and every objective.status comes
  //     back as 'active' — the DEFAULT, not the truth. The truth is in
  //     status_event. A down migration restores the shape; it is not a backup.
  pgm.sql(`
    CREATE TYPE objective_status AS ENUM ('active', 'paused', 'completed', 'ended');
    CREATE TYPE period_kind AS ENUM ('day', 'week');

    ALTER TABLE objective
      ADD COLUMN status objective_status NOT NULL DEFAULT 'active';

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
  `);
};
