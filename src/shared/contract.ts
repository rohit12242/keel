/**
 * TypeScript shapes for the API responses in docs/keel-api.yaml. The contract
 * is the source of truth; these are the same shapes, typed. Pure types — safe
 * for domain to import.
 */

export type Schedule = {
  mode: "fixed" | "flexible";
  planned_weekdays?: number[];
  days_per_week?: number;
  minutes_per_planned_day: number;
  label: string;
};

/** Computed from the segment and the status events (ADR-008) — no id: a slot
 * is a value, not a row. */
export type PlanSlot = {
  period_kind: "day" | "week";
  period_start: string;
  period_end: string;
  target_minutes: number;
  target_days: number | null;
};

export type EffortEntryWrite = {
  local_date: string;
  tz: string;
  minutes: number;
  note: string;
  occurred_at_local?: string;
  link?: string | null;
};

export type EffortEntry = {
  id: string;
  objective_id: string;
  local_date: string;
  tz: string;
  minutes: number;
  note: string;
  occurred_at_local?: string;
  link?: string | null;
  logged_at: string;
  /** Computed, never stored: true when no day slot covers local_date. */
  extra: boolean;
};

export type DayObjective = {
  id: string;
  title: string;
  schedule: Schedule;
  slot: PlanSlot | null;
  next_planned_date?: string | null;
  entries: EffortEntry[];
  logged_minutes: number;
  period_logged_minutes?: number;
};

export type Day = {
  date: string;
  objectives: DayObjective[];
  totals: {
    today_minutes: number;
    week_minutes: number;
    extra_off_day_minutes: number;
  };
  /** No deviation table yet (later story), so always null for now. */
  last_deviation: null;
};

/** Every field computed at read time; none stored, none writable (NFR-09). */
export type Figures = {
  adherence_pct: number;
  logged_minutes: number;
  target_minutes: number;
  planned_days?: number;
  planned_days_worked?: number;
  target_met_days?: number;
  extra_off_day_minutes?: number;
};

export type ObjectiveStatus = "active" | "paused" | "completed" | "ended";

export type ObjectiveWrite = {
  title: string;
  description?: string;
  why_now: string;
  success_criteria: string;
  plan_link?: string | null;
  schedule: Omit<Schedule, "label">;
  starts_on: string;
  /** Validated, never stored (I-01). */
  tz: string;
  runs_for_days: number;
  review_cadence: "weekly" | "monthly";
  from_parked_idea_id?: string | null;
};

export type ObjectiveSummary = {
  id: string;
  title: string;
  /** Derived from the latest status event; never stored (ADR-008). */
  status: ObjectiveStatus;
  schedule: Schedule;
  start_date: string;
  /** The latest segment's end. Derived. */
  end_date: string;
  next_review_on?: string | null;
  from_parking_lot?: boolean;
  figures: Figures;
};

export type PlanSegment = {
  id: string;
  seq: number;
  schedule: Schedule;
  start_date: string;
  end_date: string;
  reason: string;
  created_by_review_id?: string | null;
};

/** A row of the status history: a status event, or an extension (a segment). */
export type StatusEvent = {
  occurred_on: string;
  change: "created" | "paused" | "resumed" | "completed" | "ended" | "extended";
  reason?: string | null;
  /** Present only on extended rows. */
  new_end_date?: string | null;
};

export type Objective = ObjectiveSummary & {
  description?: string;
  why_now: string;
  success_criteria: string;
  plan_link?: string | null;
  review_cadence?: "weekly" | "monthly";
  original_end_date?: string;
  extension_count?: number;
  segments: PlanSegment[];
  status_history: StatusEvent[];
};

export type DayState =
  | "target_met"
  | "worked_short"
  | "planned_no_log"
  | "off_day"
  | "off_day_worked";

export type ScheduleDay = {
  date: string;
  state: DayState;
  segment_id: string;
  logged_minutes?: number;
  target_minutes?: number;
};

export type ScheduleGrid = {
  objective_id: string;
  from: string;
  to: string;
  days: ScheduleDay[];
};

export type ProblemError = { field: string; message: string };

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: ProblemError[];
};
