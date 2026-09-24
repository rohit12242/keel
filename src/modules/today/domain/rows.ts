import type { StatusEventRow } from "@/modules/objectives/domain/statusTimeline";

/**
 * The row shape the Today query returns and the domain assembler consumes.
 * Lives in domain so the assembler can import it; repo.ts (which produces it)
 * imports it too. domain never imports repo (ADR-001), so the shared shape is
 * defined here, on the pure side.
 *
 * Since W4-29 the query returns facts only — segments, status events, the day's
 * entries — and the domain computes what follows: the covering slot, whether an
 * entry is extra, the next planned date, and which objectives are active
 * (ADR-008).
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
};

export type DaySegmentRow = {
  seq: number;
  schedule_mode: "fixed" | "flexible";
  planned_weekdays: number | null;
  days_per_week: number | null;
  minutes_per_planned_day: number;
  start_date: string;
  end_date: string;
};

export type DayObjectiveRow = {
  id: string;
  title: string;
  segments: DaySegmentRow[];
  status_events: StatusEventRow[];
  entries: DayEntryRow[];
  /** This objective's minutes for the whole week the date falls in. */
  week_minutes: number;
};
