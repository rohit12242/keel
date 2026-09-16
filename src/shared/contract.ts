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

export type PlanSlot = {
  id: string;
  period_kind: "day" | "week";
  period_start: string;
  period_end: string;
  target_minutes: number;
  target_days: number | null;
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

export type ProblemError = { field: string; message: string };

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: ProblemError[];
};
