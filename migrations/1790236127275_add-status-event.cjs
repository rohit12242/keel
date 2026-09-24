/**
 * W4-10 — the EXPAND step of expand-migrate-contract (ADR-004).
 *
 * Adds what ADR-008 and ERD revision 3 require, and **drops nothing**:
 *
 *   - status_event, where an objective's status now lives (ADR-008). Every
 *     existing objective is backfilled a `created` event, because ERD
 *     invariant 16 says an objective without one has no status at all.
 *   - the constraints the ERD names and W3-12 missed.
 *
 * plan_slot, objective.status, and the objective_status / period_kind types stay
 * exactly as they are. `GET /day/{date}` is deployed and still reads them
 * (today/repo.ts joins plan_slot; assembleDay emits a slot id the contract marks
 * required), so dropping them here would break a live endpoint. W4-29 moves the
 * readers, W4-30 does the dropping. See G-15.
 *
 * occurred_on is a DATE — the local day the change happened, the same discipline
 * as effort_entry.local_date (NFR-12). recorded_at is the separate instant the
 * row was written. Neither is derived from the other.
 *
 * Append-only (ERD status_event) is a CONVENTION here, not a constraint: nothing
 * in this migration prevents an UPDATE or DELETE. See the handover.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE status_change AS ENUM ('created', 'paused', 'resumed', 'completed', 'ended');

    -- The objective's status history, and since ADR-008 its status: the current
    -- status is the latest event. No 'extended' — an extension is a plan
    -- segment, and storing it twice is how the history panel grows duplicates.
    CREATE TABLE status_event (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      objective_id uuid NOT NULL REFERENCES objective(id),
      occurred_on  date NOT NULL,
      change       status_change NOT NULL,
      reason       text,
      recorded_at  timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX status_event_objective_occurred_idx
      ON status_event (objective_id, occurred_on);

    -- Half of invariant 16, and the half a constraint can hold: at most one
    -- 'created' event per objective. (The at-least-one half needs code — it is
    -- asserted below for existing rows, and belongs to the create-objective
    -- service from E-02 onward.) This is also what stops a re-run of the
    -- backfill below from doubling the rows.
    CREATE UNIQUE INDEX status_event_one_created_idx
      ON status_event (objective_id) WHERE change = 'created';

    -- Backfill: one 'created' per existing objective, dated from segment 0's
    -- start — the day the commitment began, which is the honest occurred_on.
    -- reason stays NULL rather than inventing user-facing text (the ERD says
    -- some rows on screen are blank).
    INSERT INTO status_event (objective_id, occurred_on, change)
    SELECT o.id, s.start_date, 'created'
    FROM objective o
    JOIN plan_segment s ON s.objective_id = o.id AND s.seq = 0;

    -- Prove invariant 16 rather than assume it. An objective with no segment 0
    -- would silently have been skipped above; fail the migration instead.
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM objective o
        WHERE NOT EXISTS (
          SELECT 1 FROM status_event e
          WHERE e.objective_id = o.id AND e.change = 'created'
        )
      ) THEN
        RAISE EXCEPTION
          'W4-10 backfill: % objective(s) have no created event (invariant 16). Every objective needs a segment 0 to date it from.',
          (SELECT count(*) FROM objective o WHERE NOT EXISTS (
             SELECT 1 FROM status_event e
             WHERE e.objective_id = o.id AND e.change = 'created'));
      END IF;
    END $$;

    -- ---------------------------------------------------------------------
    -- Constraints the ERD names and W3-12 missed.
    -- ---------------------------------------------------------------------

    -- ERD: days_per_week is a count of days in a week; planned_weekdays is a
    -- "Bitmask Mon–Sun", so 1..127 — 0 would be a fixed segment that plans no
    -- day at all, which generateSlots would turn into an empty plan.
    ALTER TABLE plan_segment
      ADD CONSTRAINT plan_segment_days_per_week
        CHECK (days_per_week IS NULL OR days_per_week BETWEEN 1 AND 7),
      ADD CONSTRAINT plan_segment_planned_weekdays
        CHECK (planned_weekdays IS NULL OR planned_weekdays BETWEEN 1 AND 127),
      ADD CONSTRAINT plan_segment_minutes_positive
        CHECK (minutes_per_planned_day > 0),
      -- ERD: "0 is the original plan. 1, 2, 3 are extensions."
      ADD CONSTRAINT plan_segment_seq_non_negative
        CHECK (seq >= 0);

    -- Invariant 4's other half. plan_segment_no_overlap (W3-12) refuses two
    -- segments covering the same date, but permits a GAP between them — and a
    -- gap is a stretch of the objective's run with no plan at all.
    --
    -- This needs a constraint trigger, not a CHECK: contiguity is a property of
    -- the sequence, which no row-level constraint can see. ADR-008 (amended by
    -- this story) carves out this one exception to "no rule lives in a trigger",
    -- and the reasoning is recorded there. It is DEFERRABLE INITIALLY DEFERRED
    -- so a transaction may write several segments in any order and be judged
    -- once, at COMMIT.
    CREATE FUNCTION plan_segment_contiguous() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      target uuid := COALESCE(NEW.objective_id, OLD.objective_id);
      bad    record;
    BEGIN
      SELECT * INTO bad FROM (
        SELECT start_date,
               LAG(end_date) OVER (ORDER BY start_date) AS prev_end
        FROM plan_segment
        WHERE objective_id = target
      ) ordered
      WHERE prev_end IS NOT NULL AND start_date <> prev_end + 1
      LIMIT 1;

      IF FOUND THEN
        RAISE EXCEPTION
          'plan_segment_contiguous: objective % is not contiguous — a segment starts on % but the previous one ends on % (invariant 4)',
          target, bad.start_date, bad.prev_end
          USING ERRCODE = 'check_violation';
      END IF;

      RETURN NULL;
    END $$;

    CREATE CONSTRAINT TRIGGER plan_segment_contiguous
      AFTER INSERT OR UPDATE OR DELETE ON plan_segment
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION plan_segment_contiguous();
  `);
};

exports.down = (pgm) => {
  // Reverses exactly this migration. Touches nothing W3-12 created.
  pgm.sql(`
    DROP TRIGGER IF EXISTS plan_segment_contiguous ON plan_segment;
    DROP FUNCTION IF EXISTS plan_segment_contiguous();

    ALTER TABLE plan_segment
      DROP CONSTRAINT IF EXISTS plan_segment_seq_non_negative,
      DROP CONSTRAINT IF EXISTS plan_segment_minutes_positive,
      DROP CONSTRAINT IF EXISTS plan_segment_planned_weekdays,
      DROP CONSTRAINT IF EXISTS plan_segment_days_per_week;

    DROP TABLE IF EXISTS status_event;
    DROP TYPE IF EXISTS status_change;
  `);
};
