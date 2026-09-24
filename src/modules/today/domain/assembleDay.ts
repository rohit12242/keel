import type { Day, DayObjective, EffortEntry } from "@/shared/contract";
import { bitmaskToWeekdays } from "@/modules/objectives/domain/weekdays";
import { scheduleLabel } from "@/modules/objectives/domain/scheduleLabel";
import {
  coveringSlot,
  nextPlannedDate,
} from "@/modules/objectives/domain/coveringSlot";
import type { SegmentForSlots } from "@/modules/objectives/domain/generateSlots";
import { currentStatus } from "@/modules/objectives/domain/statusTimeline";
import type { DayObjectiveRow, DayEntryRow, DaySegmentRow } from "./rows";

/**
 * Shape the query rows into the Day the contract declares (ADR-001 domain:
 * pure). Since W4-29 this also *computes* what the query used to read from
 * `plan_slot`: the covering slot, whether an entry is extra, the next planned
 * date, and which objectives are active (ADR-008).
 *
 * Totals are summed from the same rows — no extra read.
 */

/** The repository's segment row, as `generateSlots` wants it. */
function toSegment(row: DaySegmentRow): SegmentForSlots {
  return {
    scheduleMode: row.schedule_mode,
    plannedWeekdays: bitmaskToWeekdays(row.planned_weekdays ?? 0),
    minutesPerPlannedDay: row.minutes_per_planned_day,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

/**
 * The segment whose range covers the date, else the latest by seq — so an
 * out-of-plan date still shows a schedule, with no slot.
 */
function segmentInForce(
  segments: DaySegmentRow[],
  date: string,
): DaySegmentRow | undefined {
  const covering = segments.find(
    (s) => s.start_date <= date && date <= s.end_date,
  );
  if (covering) return covering;
  return segments.reduce<DaySegmentRow | undefined>(
    (latest, s) => (latest === undefined || s.seq > latest.seq ? s : latest),
    undefined,
  );
}

function toEntry(row: DayEntryRow, extra: boolean): EffortEntry {
  const entry: EffortEntry = {
    id: row.id,
    objective_id: row.objective_id,
    local_date: row.local_date,
    tz: row.tz,
    minutes: row.minutes,
    note: row.note,
    link: row.link,
    logged_at: row.logged_at,
    extra,
  };
  if (row.occurred_at_local) entry.occurred_at_local = row.occurred_at_local;
  return entry;
}

function toObjective(row: DayObjectiveRow, date: string): DayObjective {
  const segments = row.segments.map(toSegment);
  const slot = coveringSlot(segments, row.status_events, date);
  const inForce = segmentInForce(row.segments, date);
  const isFixed = inForce?.schedule_mode === "fixed";

  // Every entry here is for `date`, so one slot decides them all: an entry is
  // extra when no day slot covers its date (contract wording, ERD invariant 10).
  const extra = slot === null;

  return {
    id: row.id,
    title: row.title,
    schedule: {
      mode: inForce?.schedule_mode ?? "fixed",
      minutes_per_planned_day: inForce?.minutes_per_planned_day ?? 0,
      ...(isFixed
        ? {
            planned_weekdays: bitmaskToWeekdays(inForce?.planned_weekdays ?? 0),
          }
        : { days_per_week: inForce?.days_per_week ?? 0 }),
      label: scheduleLabel({
        mode: inForce?.schedule_mode ?? "fixed",
        plannedWeekdays: bitmaskToWeekdays(inForce?.planned_weekdays ?? 0),
        daysPerWeek: inForce?.days_per_week ?? undefined,
        minutesPerPlannedDay: inForce?.minutes_per_planned_day ?? 0,
      }),
    },
    // A computed slot has no id — it is a value, not a row (W4-29, G-15).
    slot: slot
      ? {
          period_kind: slot.periodKind,
          period_start: slot.periodStart,
          period_end: slot.periodEnd,
          target_minutes: slot.targetMinutes,
          target_days: slot.targetDays,
        }
      : null,
    next_planned_date: nextPlannedDate(segments, row.status_events, date),
    entries: row.entries.map((e) => toEntry(e, extra)),
    logged_minutes: row.entries.reduce((sum, e) => sum + e.minutes, 0),
  };
}

export function assembleDay(date: string, rows: DayObjectiveRow[]): Day {
  // The status is the latest status event; the query no longer filters on a
  // status column (ADR-008). Objectives that are paused, completed or ended —
  // and any with no events at all — are not on Today.
  const active = rows.filter(
    (row) => currentStatus(row.status_events) === "active",
  );

  const objectives = active.map((row) => toObjective(row, date));

  return {
    date,
    objectives,
    totals: {
      today_minutes: objectives.reduce((sum, o) => sum + o.logged_minutes, 0),
      week_minutes: active.reduce((sum, r) => sum + r.week_minutes, 0),
      extra_off_day_minutes: objectives.reduce(
        (sum, o) =>
          sum + o.entries.reduce((s, e) => s + (e.extra ? e.minutes : 0), 0),
        0,
      ),
    },
    last_deviation: null,
  };
}
