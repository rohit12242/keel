import type { ProblemError } from "@/shared/contract";
import { err, ok, type Result } from "@/shared/result";
import { isIsoDate } from "@/modules/effort/domain/validateWrite";
import {
  currentStatus,
  type ObjectiveStatus,
  type StatusChange,
  type StatusEventRow,
} from "./statusTimeline";

/**
 * Pause, resume, complete or end (ADR-001 domain: pure). The history is
 * append-only (ERD, *Status event*): a change is a new event that must follow
 * from the status the history already gives, dated no earlier than the latest
 * event, so it can never rewrite the order of what happened.
 *
 * The transition table:
 *
 * | from      | pause | resume | complete | end |
 * |-----------|-------|--------|----------|-----|
 * | active    | ✓     |        | ✓        | ✓   |
 * | paused    |       | ✓      | ✓        | ✓   |
 * | completed |       |        |          |     |
 * | ended     |       |        |          |     |
 *
 * Completed and ended are final: nothing follows them.
 */
export type ChangeRequest = "pause" | "resume" | "complete" | "end";

export type StatusChangeWrite = {
  change: ChangeRequest;
  occurred_on: string;
  reason: string | null;
};

const EVENT_FOR: Record<ChangeRequest, StatusChange> = {
  pause: "paused",
  resume: "resumed",
  complete: "completed",
  end: "ended",
};

const ALLOWED_FROM: Record<ChangeRequest, readonly ObjectiveStatus[]> = {
  pause: ["active"],
  resume: ["paused"],
  complete: ["active", "paused"],
  end: ["active", "paused"],
};

export function validateStatusChange(
  input: unknown,
): Result<StatusChangeWrite, ProblemError[]> {
  const body =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: ProblemError[] = [];
  if (
    typeof body.change !== "string" ||
    !Object.hasOwn(EVENT_FOR, body.change)
  ) {
    errors.push({
      field: "change",
      message: "Required; one of pause, resume, complete, end.",
    });
  }
  if (typeof body.occurred_on !== "string" || !isIsoDate(body.occurred_on)) {
    errors.push({ field: "occurred_on", message: "Required; YYYY-MM-DD." });
  }
  const reason = body.reason;
  if (
    reason !== undefined &&
    reason !== null &&
    (typeof reason !== "string" || reason.length > 2000)
  ) {
    errors.push({ field: "reason", message: "Up to 2000 characters." });
  }
  if (errors.length > 0) return err(errors);
  return ok({
    change: body.change as ChangeRequest,
    occurred_on: body.occurred_on as string,
    reason: typeof reason === "string" ? reason : null,
  });
}

export type ChangeRefusal =
  | { kind: "does_not_follow"; from: ObjectiveStatus | null }
  | { kind: "before_latest"; latest: string };

/** The event to append, or why it cannot be. */
export function statusChange(
  events: readonly StatusEventRow[],
  request: StatusChangeWrite,
): Result<StatusChange, ChangeRefusal> {
  const from = currentStatus(events);
  if (from === null || !ALLOWED_FROM[request.change].includes(from)) {
    return err({ kind: "does_not_follow", from });
  }
  const latest = events.reduce(
    (max, e) => (e.occurred_on > max ? e.occurred_on : max),
    "",
  );
  if (request.occurred_on < latest) {
    return err({ kind: "before_latest", latest });
  }
  return ok(EVENT_FOR[request.change]);
}
