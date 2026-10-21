import type {
  Day,
  DayObjective,
  EffortEntry,
  Deviation,
} from "@/shared/contract";
import { bitmaskToWeekdays } from "@/modules/objectives/domain/weekdays";
import { scheduleLabel } from "@/modules/objectives/domain/scheduleLabel";
import {
  coveringSlot,
  nextPlannedDate,
} from "@/modules/objectives/domain/coveringSlot";
import { currentStatus } from "@/modules/objectives/domain/statusTimeline";
import {
  toSegment,
  type PlanSegmentRow,
} from "@/modules/objectives/domain/segmentRows";
import { planSlots } from "@/modules/objectives/domain/planSlots";
import {
  datesBetween,
  parseIso,
  toIso,
} from "@/modules/objectives/domain/generateSlots";
import {
  figuresToDate,
  type DailyMinutes,
} from "@/modules/effort/domain/adherence";
import { trackOf } from "@/modules/effort/domain/track";
import { mondayOf } from "@/modules/effort/domain/effortMonth";
import type { DayObjectiveRow, DayEntryRow } from "./rows";

/**
 * Shape the query rows into the Day the contract declares (ADR-001 domain:
 * pure). Since W4-29 this also *computes* what the query used to read from
 * `plan_slot`: the covering slot, whether an entry is extra, the next planned
 * date, and which objectives are active (ADR-008).
 *
 * Totals are summed from the same rows — no extra read. Since I-03 each row
 * also carries its minutes per date, so the slot's progress through its week,
 * the figures to date and the band come from the same one query (G24–G28).
 */

/**
 * The segment whose range covers the date, else the latest by seq — so an
 * out-of-plan date still shows a schedule, with no slot.
 */
function segmentInForce(
  segments: PlanSegmentRow[],
  date: string,
): PlanSegmentRow | undefined {
  const covering = segments.find(
    (s) => s.start_date <= date && date <= s.end_date,
  );
  if (covering) return covering;
  return segments.reduce<PlanSegmentRow | undefined>(
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

const dailyOf = (row: DayObjectiveRow): DailyMinutes =>
  Object.fromEntries(row.daily_minutes.map((d) => [d.local_date, d.minutes]));

/** The minutes, and the days with any, from `from` through `to` (from ≤ to). */
function across(daily: DailyMinutes, from: string, to: string) {
  const days = datesBetween(from, to);
  return {
    minutes: days.reduce((sum, d) => sum + (daily[d] ?? 0), 0),
    worked: days.filter((d) => (daily[d] ?? 0) > 0).length,
  };
}

function toObjective(row: DayObjectiveRow, date: string): DayObjective {
  const segments = row.segments.map(toSegment);
  const slot = coveringSlot(segments, row.status_events, date);
  const inForce = segmentInForce(row.segments, date);
  const isFixed = inForce?.schedule_mode === "fixed";
  const slots = planSlots(segments, row.status_events);
  const daily = dailyOf(row);
  const toDate = figuresToDate(slots, daily, date);
  // Segment 0 starts the objective; one with no plan degrades, like its schedule.
  const first = [...row.segments].sort((a, b) => a.seq - b.seq)[0];

  // Every entry here is for `date`, so one slot decides them all: an entry is
  // extra when no day slot covers its date (contract wording, ERD invariant 10).
  const extra = slot === null;

  // A flexible card reads its week so far: up to and including the date (G24).
  const week =
    slot?.periodKind === "week" ? across(daily, slot.periodStart, date) : null;

  return {
    id: row.id,
    title: row.title,
    start_date: first?.start_date ?? date,
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
    ...(week
      ? {
          period_logged_minutes: week.minutes,
          period_days_worked: week.worked,
        }
      : {}),
    // The rail's "plan to date", from the rule the objectives read uses (G25).
    adherence_to_date: toDate.adherence_pct,
    track: trackOf(
      toDate,
      slots.some((s) => s.periodEnd < date),
    ),
  };
}

/**
 * The week the totals read: Monday to Sunday around the date. Its extra is
 * the minutes on days no slot of the objective covers (G28).
 */
function weekOf(row: DayObjectiveRow, date: string) {
  const monday = mondayOf(date);
  const sunday = toIso(parseIso(monday) + 6 * 86_400_000);
  const daily = dailyOf(row);
  const days = datesBetween(monday, sunday);
  const covered = new Set(
    planSlots(row.segments.map(toSegment), row.status_events).flatMap(
      (s) => s.activeDays,
    ),
  );
  return {
    minutes: days.reduce((sum, d) => sum + (daily[d] ?? 0), 0),
    extra: days
      .filter((d) => !covered.has(d))
      .reduce((sum, d) => sum + (daily[d] ?? 0), 0),
  };
}

export function assembleDay(
  date: string,
  rows: DayObjectiveRow[],
  lastDeviation: Deviation | null,
): Day {
  // The status is the latest status event; the query no longer filters on a
  // status column (ADR-008). Objectives that are paused, completed or ended —
  // and any with no events at all — are not on Today.
  const active = rows.filter(
    (row) => currentStatus(row.status_events) === "active",
  );

  const objectives = active.map((row) => toObjective(row, date));
  const weeks = active.map((row) => weekOf(row, date));

  // Only a fixed day slot plans time for a particular day; a flexible week
  // plans none (G27). What is still to go never goes below zero.
  const planned = objectives.flatMap((o) =>
    o.slot?.period_kind === "day"
      ? [{ target: o.slot.target_minutes, logged: o.logged_minutes }]
      : [],
  );

  return {
    date,
    objectives,
    totals: {
      today_minutes: objectives.reduce((sum, o) => sum + o.logged_minutes, 0),
      week_minutes: weeks.reduce((sum, w) => sum + w.minutes, 0),
      extra_off_day_minutes: weeks.reduce((sum, w) => sum + w.extra, 0),
      today_planned_minutes: planned.reduce((sum, p) => sum + p.target, 0),
      today_to_go_minutes: planned.reduce(
        (sum, p) => sum + Math.max(0, p.target - p.logged),
        0,
      ),
    },
    last_deviation: lastDeviation,
  };
}
