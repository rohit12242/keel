import type {
  Objective,
  ObjectiveStatus,
  ObjectiveSummary,
  PlanSegment,
  Schedule,
  StatusEvent,
} from "@/shared/contract";
import { err, ok, type Result } from "@/shared/result";
import {
  figures,
  figuresToDate,
  type DailyMinutes,
} from "@/modules/effort/domain/adherence";
import { trackOf } from "@/modules/effort/domain/track";
import { planSlots } from "./planSlots";
import { scheduleLabel } from "./scheduleLabel";
import { toSegment } from "./segmentRows";
import { currentStatus } from "./statusTimeline";
import { bitmaskToWeekdays } from "./weekdays";
import {
  dueWindows,
  periodKey,
  reviewSchedule,
  upcomingReviewOn,
} from "@/modules/reviews/domain/reviewWindows";
import type { ObjectiveRow, ObjectiveSegmentRow } from "./rows";

/**
 * Shape the objectives read into what the contract declares (ADR-001 domain:
 * pure). Everything except the stored text is computed here from the facts
 * (ADR-008): the status from the status events, the dates from the segments,
 * the figures from the planned slots and the minutes logged.
 *
 * `next_review_on` and `reviews_due` come from the review windows
 * (docs/domain/review-windows.md), read against `today` in the caller's zone.
 * `criteria_verdict` is the latest saved plan-end review's (invariant 8).
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

function summaryOf(
  row: ObjectiveRow,
  wf: WellFormed,
  today: string,
): ObjectiveSummary {
  const first = wf.segments[0];
  const latest = wf.segments[wf.segments.length - 1];
  const slots = planSlots(wf.segments.map(toSegment), row.status_events);
  const windows = {
    schedule: reviewSchedule(row.review_cadence, wf.segments),
    today,
    status: wf.status,
    saved: new Set(row.saved_reviews.map(periodKey)),
    slots,
  };
  const due = dueWindows(windows);
  const daily = dailyMinutesOf(row);
  const toDate = figuresToDate(slots, daily, today);
  return {
    id: row.id,
    title: row.title,
    status: wf.status,
    // Events are in date order, and a well-formed objective has one (G23).
    status_since: row.status_events[row.status_events.length - 1].occurred_on,
    // The schedule shown is the latest segment's: the plan as it now stands.
    schedule: toSchedule(latest),
    start_date: first.start_date,
    end_date: latest.end_date,
    next_review_on: due.length > 0 ? due[0].period_end : null,
    reviews_due: due.length,
    upcoming_review_on: upcomingReviewOn(windows),
    from_parking_lot: row.from_parked_idea_id !== null,
    figures: figures(slots, daily),
    figures_to_date: toDate,
    track: trackOf(
      toDate,
      slots.some((s) => s.periodEnd < today),
    ),
  };
}

export function assembleSummary(
  row: ObjectiveRow,
  today: string,
): Result<ObjectiveSummary, Malformed> {
  const wf = wellFormed(row);
  return wf.ok ? ok(summaryOf(row, wf.value, today)) : wf;
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

/** The verdict of the latest saved plan-end review — after an extension, the second one's. */
function criteriaVerdictOf(row: ObjectiveRow): Objective["criteria_verdict"] {
  const planEnds = row.saved_reviews.filter((r) => r.kind === "plan_end");
  return planEnds.length > 0
    ? planEnds[planEnds.length - 1].criteria_verdict
    : null;
}

export function assembleObjective(
  row: ObjectiveRow,
  today: string,
): Result<Objective, Malformed> {
  const wf = wellFormed(row);
  if (!wf.ok) return wf;
  const { segments } = wf.value;

  const objective: Objective = {
    ...summaryOf(row, wf.value, today),
    why_now: row.why_now,
    success_criteria: row.success_criteria,
    plan_link: row.plan_link,
    review_cadence: row.review_cadence,
    original_end_date: segments[0].end_date,
    extension_count: segments.length - 1,
    segments: segments.map(toPlanSegment),
    status_history: statusHistory(row, segments),
    notes: row.notes,
    // daily_minutes is in date order, so the last one is the latest (G18).
    last_logged_on: row.daily_minutes.at(-1)?.local_date ?? null,
    criteria_verdict: criteriaVerdictOf(row),
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
  today: string,
): Result<ObjectiveSummary[], Malformed> {
  const summaries: ObjectiveSummary[] = [];
  for (const row of rows) {
    const summary = assembleSummary(row, today);
    if (!summary.ok) return summary;
    if (filter === "all" || summary.value.status === filter) {
      summaries.push(summary.value);
    }
  }
  return ok(summaries);
}
