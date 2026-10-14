import type { ProblemError } from "@/shared/contract";
import { err, ok, type Result } from "@/shared/result";
import { parseIso, toIso } from "./generateSlots";
import type { ObjectiveRow } from "./rows";
import {
  missesEveryWeekday,
  normaliseSchedule,
  parseSchedule,
  type NewSchedule,
} from "./validateObjectiveWrite";

/**
 * Extending a plan (ADR-001 domain: pure; invariants 4–7). A new segment
 * starts the day after the plan now ends and carries its own schedule. Two
 * rules the contract enforces rather than the UI:
 *
 * - it is authorised by a saved plan-end review of the plan as it stands,
 *   whose outcome is `continued` and which has not already extended it — and
 *   only once the plan's end date has passed (409);
 * - the new end date is strictly after today, refused rather than adjusted
 *   (422, invariant 6).
 */
export type ExtensionWrite = {
  review_id: string;
  extend_by_days: number;
  reason: string;
  schedule: NewSchedule;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateExtensionWrite(
  input: unknown,
): Result<ExtensionWrite, ProblemError[]> {
  const body =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: ProblemError[] = [];
  if (typeof body.review_id !== "string" || !UUID.test(body.review_id)) {
    errors.push({
      field: "review_id",
      message: "Required; the plan-end review's id.",
    });
  }
  const days = body.extend_by_days;
  if (
    typeof days !== "number" ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  ) {
    errors.push({
      field: "extend_by_days",
      message: "Required; an integer from 1 to 365.",
    });
  }
  if (!(
    typeof body.reason === "string" &&
    body.reason.length >= 1 &&
    body.reason.length <= 2000
  )) {
    errors.push({
      field: "reason",
      message: "Required; 1–2000 characters. Why extend rather than complete?",
    });
  }
  const schedule = parseSchedule(body.schedule);
  errors.push(...schedule.errors);
  if (schedule.errors.length === 0 && schedule.mismatch !== null) {
    errors.push({ field: "schedule", message: schedule.mismatch });
  }
  if (errors.length > 0) return err(errors);
  return ok({
    review_id: body.review_id as string,
    extend_by_days: days as number,
    reason: body.reason as string,
    schedule: normaliseSchedule(body.schedule),
  });
}

export type NewSegment = {
  seq: number;
  start_date: string;
  end_date: string;
  schedule: NewSchedule;
  reason: string;
  created_by_review_id: string;
};

export type ExtensionRefusal =
  | { kind: "invalid"; error: ProblemError }
  | { kind: "conflict"; detail: string }
  | { kind: "not_in_future"; detail: string };

const DAY = 86_400_000;

export function extensionDecision(
  row: ObjectiveRow,
  write: ExtensionWrite,
  today: string,
): Result<NewSegment, ExtensionRefusal> {
  const segments = [...row.segments].sort((a, b) => a.seq - b.seq);
  const latest = segments[segments.length - 1];
  const review = row.saved_reviews.find((r) => r.id === write.review_id);

  if (
    !review ||
    review.kind !== "plan_end" ||
    review.period_end !== latest.end_date
  ) {
    const used = segments.some(
      (s) => s.created_by_review_id === write.review_id,
    );
    return err({
      kind: "conflict",
      detail: used
        ? "That review has already extended the plan; each continued review extends it once."
        : "No saved plan-end review of the plan as it stands authorises this.",
    });
  }
  if (review.outcome !== "continued") {
    return err({
      kind: "conflict",
      detail: `The review's outcome is ${review.outcome}; only continued extends a plan.`,
    });
  }
  if (today <= latest.end_date) {
    return err({
      kind: "conflict",
      detail: `The plan runs to ${latest.end_date}; it is extended once that day has passed.`,
    });
  }

  const start = toIso(parseIso(latest.end_date) + DAY);
  const end = toIso(parseIso(start) + (write.extend_by_days - 1) * DAY);
  if (end <= today) {
    return err({
      kind: "not_in_future",
      detail: `The extension would end on ${end}, not after today (${today}). It is refused, not adjusted.`,
    });
  }
  const missed = missesEveryWeekday(write.schedule, start, end);
  if (missed) return err({ kind: "invalid", error: missed });

  return ok({
    seq: latest.seq + 1,
    start_date: start,
    end_date: end,
    schedule: write.schedule,
    reason: write.reason,
    created_by_review_id: write.review_id,
  });
}
