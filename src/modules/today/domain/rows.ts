/**
 * The row shape the Today query returns and the domain assembler consumes.
 * Lives in domain so the assembler can import it; repo.ts (which produces it)
 * imports it too. domain never imports repo (ADR-001), so the shared shape is
 * defined here, on the pure side.
 */
export type DayEntryRow = {
  id: string;
  objective_id: string;
  local_date: string;
  tz: string;
  minutes: number;
  note: string;
  link: string | null;
  occurred_at_local: string | null;
  logged_at: string;
  extra: boolean;
};

export type DayObjectiveRow = {
  id: string;
  title: string;
  schedule_mode: "fixed" | "flexible";
  planned_weekdays: number | null;
  days_per_week: number | null;
  minutes_per_planned_day: number;
  slot_id: string | null;
  period_kind: "day" | "week" | null;
  period_start: string | null;
  period_end: string | null;
  target_minutes: number | null;
  target_days: number | null;
  entries: DayEntryRow[];
  logged_minutes: number;
  extra_minutes: number;
  next_planned_date: string | null;
  week_minutes: number;
};
