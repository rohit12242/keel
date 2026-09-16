import type { Day, DayObjective, EffortEntry } from "@/shared/contract";
import { bitmaskToWeekdays } from "@/modules/objectives/domain/weekdays";
import { scheduleLabel } from "@/modules/objectives/domain/scheduleLabel";
import type { DayObjectiveRow, DayEntryRow } from "./rows";

/**
 * Shape the query rows into the Day the contract declares (ADR-001 domain:
 * pure). Totals are summed here from the same rows the query returned — no
 * extra read. `week_minutes` is carried on every row (the query's cross join);
 * with no rows there is nothing logged, so it is zero.
 */

function toEntry(row: DayEntryRow): EffortEntry {
  const entry: EffortEntry = {
    id: row.id,
    objective_id: row.objective_id,
    local_date: row.local_date,
    tz: row.tz,
    minutes: row.minutes,
    note: row.note,
    link: row.link,
    logged_at: row.logged_at,
    extra: row.extra,
  };
  if (row.occurred_at_local) entry.occurred_at_local = row.occurred_at_local;
  return entry;
}

function toObjective(row: DayObjectiveRow): DayObjective {
  const isFixed = row.schedule_mode === "fixed";
  return {
    id: row.id,
    title: row.title,
    schedule: {
      mode: row.schedule_mode,
      minutes_per_planned_day: row.minutes_per_planned_day,
      ...(isFixed
        ? { planned_weekdays: bitmaskToWeekdays(row.planned_weekdays ?? 0) }
        : { days_per_week: row.days_per_week ?? 0 }),
      label: scheduleLabel({
        mode: row.schedule_mode,
        plannedWeekdays: bitmaskToWeekdays(row.planned_weekdays ?? 0),
        daysPerWeek: row.days_per_week ?? undefined,
        minutesPerPlannedDay: row.minutes_per_planned_day,
      }),
    },
    slot: row.slot_id
      ? {
          id: row.slot_id,
          period_kind: row.period_kind!,
          period_start: row.period_start!,
          period_end: row.period_end!,
          target_minutes: row.target_minutes!,
          target_days: row.target_days,
        }
      : null,
    next_planned_date: row.next_planned_date,
    entries: row.entries.map(toEntry),
    logged_minutes: row.logged_minutes,
  };
}

export function assembleDay(date: string, rows: DayObjectiveRow[]): Day {
  return {
    date,
    objectives: rows.map(toObjective),
    totals: {
      today_minutes: rows.reduce((sum, r) => sum + r.logged_minutes, 0),
      week_minutes: rows[0]?.week_minutes ?? 0,
      extra_off_day_minutes: rows.reduce((sum, r) => sum + r.extra_minutes, 0),
    },
    last_deviation: null,
  };
}
