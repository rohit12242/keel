import type { StatusEventRow } from "./statusTimeline";
import type { PlanSegmentRow } from "./segmentRows";

/**
 * The row shape the objectives read returns and the domain assembles. Lives
 * in domain so the assemblers can import it; repo.ts (which produces it)
 * imports it too — domain never imports repo (ADR-001).
 *
 * Facts only (ADR-008): the objective, its segments, its status events, and
 * the minutes logged per local date. Status, slots, figures and day states are
 * computed from these. Type-only, so it is outside the coverage threshold by
 * name (ADR-007, W5-06 amendment).
 */
export type ObjectiveSegmentRow = PlanSegmentRow & {
  id: string;
  reason: string;
  created_by_review_id: string | null;
};

export type ObjectiveEventRow = StatusEventRow & { reason: string | null };

export type DailyMinutesRow = { local_date: string; minutes: number };

export type ObjectiveRow = {
  id: string;
  title: string;
  description: string | null;
  why_now: string;
  success_criteria: string;
  plan_link: string | null;
  review_cadence: "weekly" | "monthly";
  from_parked_idea_id: string | null;
  /** Ordered by seq. */
  segments: ObjectiveSegmentRow[];
  /** Ordered by occurred_on, then by when each was recorded. */
  status_events: ObjectiveEventRow[];
  daily_minutes: DailyMinutesRow[];
};
