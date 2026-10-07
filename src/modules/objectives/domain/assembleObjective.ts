import type {
  Objective,
  ObjectiveStatus,
  ObjectiveSummary,
  PlanSegment,
  Schedule,
  StatusEvent,
} from "@/shared/contract";
import { err, ok, type Result } from "@/shared/result";
import { figures, type DailyMinutes } from "@/modules/effort/domain/adherence";
import { planSlots } from "./planSlots";
import { scheduleLabel } from "./scheduleLabel";
import { toSegment } from "./segmentRows";
import { currentStatus } from "./statusTimeline";
import { bitmaskToWeekdays } from "./weekdays";
import type { ObjectiveRow, ObjectiveSegmentRow } from "./rows";

/**
 * Shape the objectives read into what the contract declares (ADR-001 domain:
 * pure). Everything except the stored text is computed here from the facts
 * (ADR-008): the status from the status events, the dates from the segments,
 * the figures from the planned slots and the minutes logged.
 *
 * Omitted on purpose, because the rules behind them are not in I-01 and
 * omitting is legal where guessing is not: `next_review_on`,
 * `committed_minutes_per_week`, `criteria_verdict`.
 */

/**
 * An objective with no status events has no status, and one with no segments
 * has no plan. Neither is a state: the stored facts are malformed, and a read
 * fails rather than guessing (ERD invariant 16).
 */
export type Malformed = "malformed";

type WellFormed = {
  /** By seq: segment 0 first, the latest last. */
  segments: ObjectiveSegmentRow[];
  status: ObjectiveStatus;
};

export function wellFormed(row: ObjectiveRow): Result<WellFormed, Malformed> {
  const status = currentStatus(row.status_events);
  if (status === null || row.segments.length === 0) return err("malformed");
  const segments = [...row.segments].sort((a, b) => a.seq - b.seq);
  return ok({ segments, status });
}

export function dailyMinutesOf(row: ObjectiveRow): DailyMinutes {
  return Object.fromEntries(
    row.daily_minutes.map((d) => [d.local_date, d.minutes]),
  );
}

function toSchedule(segment: ObjectiveSegmentRow): Schedule {
  const minutes = segment.minutes_per_planned_day;
  if (segment.schedule_mode === "fixed") {
    const weekdays = bitmaskToWeekdays(segment.planned_weekdays ?? 0);
    return {
      mode: "fixed",
      planned_weekdays: weekdays,
      minutes_per_planned_day: minutes,
      label: scheduleLabel({
        mode: "fixed",
        plannedWeekdays: weekdays,
        minutesPerPlannedDay: minutes,
      }),
    };
  }
  const days = segment.days_per_week ?? 0;
  return {
    mode: "flexible",
    days_per_week: days,
    minutes_per_planned_day: minutes,
    label: scheduleLabel({
      mode: "flexible",
      daysPerWeek: days,
      minutesPerPlannedDay: minutes,
    }),
  };
}

function summaryOf(row: ObjectiveRow, wf: WellFormed): ObjectiveSummary {
  const first = wf.segments[0];
  const latest = wf.segments[wf.segments.length - 1];
  const slots = planSlots(wf.segments.map(toSegment), row.status_events);
  return {
    id: row.id,
    title: row.title,
    status: wf.status,
    // The schedule shown is the latest segment's: the plan as it now stands.
    schedule: toSchedule(latest),
    start_date: first.start_date,
    end_date: latest.end_date,
    from_parking_lot: row.from_parked_idea_id !== null,
    figures: figures(slots, dailyMinutesOf(row)),
  };
}

export function assembleSummary(
  row: ObjectiveRow,
): Result<ObjectiveSummary, Malformed> {
  const wf = wellFormed(row);
  return wf.ok ? ok(summaryOf(row, wf.value)) : wf;
}

/**
 * Status events and extensions, merged by date. The two are stored apart — an
 * extension is a segment, never a status event — and joined only here, so the
 * history can never show one twice (ERD, "a merge, not a table"). An extension
 * is dated by the day its segment starts. Same-day rows keep their order:
 * status events first, as recorded, then extensions.
 */
function statusHistory(
  row: ObjectiveRow,
  segments: ObjectiveSegmentRow[],
): StatusEvent[] {
  const events: StatusEvent[] = row.status_events.map((e) => ({
    occurred_on: e.occurred_on,
    change: e.change,
    reason: e.reason,
  }));
  const extensions: StatusEvent[] = segments
    .filter((s) => s.seq > 0)
    .map((s) => ({
      occurred_on: s.start_date,
      change: "extended",
      reason: s.reason,
      new_end_date: s.end_date,
    }));
  return [...events, ...extensions].sort((a, b) =>
    a.occurred_on < b.occurred_on ? -1 : a.occurred_on > b.occurred_on ? 1 : 0,
  );
}

function toPlanSegment(segment: ObjectiveSegmentRow): PlanSegment {
  return {
    id: segment.id,
    seq: segment.seq,
    schedule: toSchedule(segment),
    start_date: segment.start_date,
    end_date: segment.end_date,
    reason: segment.reason,
    created_by_review_id: segment.created_by_review_id,
  };
}

export function assembleObjective(
  row: ObjectiveRow,
): Result<Objective, Malformed> {
  const wf = wellFormed(row);
  if (!wf.ok) return wf;
  const { segments } = wf.value;

  const objective: Objective = {
    ...summaryOf(row, wf.value),
    why_now: row.why_now,
    success_criteria: row.success_criteria,
    plan_link: row.plan_link,
    review_cadence: row.review_cadence,
    original_end_date: segments[0].end_date,
    extension_count: segments.length - 1,
    segments: segments.map(toPlanSegment),
    status_history: statusHistory(row, segments),
  };
  // `description` is a string in the contract, never null: absent when unset.
  if (row.description !== null) objective.description = row.description;
  return ok(objective);
}

export type StatusFilter = "all" | ObjectiveStatus;
const FILTERS: readonly StatusFilter[] = [
  "all",
  "active",
  "paused",
  "completed",
  "ended",
];

/** The `status` query parameter: absent means all; anything unknown is refused. */
export function parseStatusFilter(value: string | null): StatusFilter | null {
  if (value === null) return "all";
  return (FILTERS as readonly string[]).includes(value)
    ? (value as StatusFilter)
    : null;
}

/**
 * The list: every objective, filtered by status. One malformed objective fails
 * the whole list — showing the rest with a guessed status for one would be the
 * record deciding wrongly, which is worse than not answering.
 */
export function assembleList(
  rows: readonly ObjectiveRow[],
  filter: StatusFilter,
): Result<ObjectiveSummary[], Malformed> {
  const summaries: ObjectiveSummary[] = [];
  for (const row of rows) {
    const summary = assembleSummary(row);
    if (!summary.ok) return summary;
    if (filter === "all" || summary.value.status === filter) {
      summaries.push(summary.value);
    }
  }
  return ok(summaries);
}
