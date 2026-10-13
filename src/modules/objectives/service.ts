import { withTransaction } from "@/shared/db";
import type {
  Objective,
  ObjectiveSummary,
  ProblemError,
  ScheduleGrid,
} from "@/shared/contract";
import {
  assembleList,
  assembleObjective,
  parseStatusFilter,
} from "./domain/assembleObjective";
import { assembleGrid, parseGridRange } from "./domain/scheduleGrid";
import { validateObjectiveWrite } from "./domain/validateObjectiveWrite";
import { statusChange, validateStatusChange } from "./domain/statusChange";
import type { StatusChange } from "./domain/statusTimeline";
import {
  getObjectiveRows,
  insertObjective,
  insertStatusEvent,
  lockStatusHistory,
} from "./repo";

/**
 * objectives/service — one function per use case (ADR-001). Each read is one
 * repository call, so one query (NFR-03's reason); the rules are in domain/.
 * Every function takes the signed-in user's id and reads only their rows.
 *
 * `malformed` is an objective whose stored facts have no status or no plan:
 * a read fails rather than guessing (ERD invariant 16).
 */

export type CreateObjectiveResult =
  | { ok: true; objective: Objective }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "mode_mismatch"; detail: string };

export async function createObjective(
  userId: string,
  body: unknown,
): Promise<CreateObjectiveResult> {
  const validated = validateObjectiveWrite(body);
  if (!validated.ok) return validated;

  const id = await withTransaction((tx) =>
    insertObjective(tx, userId, validated.value),
  );

  // Read it back through the same read the list uses, so a created objective
  // and a listed one cannot differ in shape or figures.
  const [row] = await getObjectiveRows(userId, id);
  const objective = row ? assembleObjective(row) : null;
  if (!objective?.ok) {
    throw new Error(`createObjective: objective ${id} did not read back`);
  }
  return { ok: true, objective: objective.value };
}

export type ListObjectivesResult =
  | { ok: true; objectives: ObjectiveSummary[] }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "malformed" };

export async function listObjectives(
  userId: string,
  status: string | null,
): Promise<ListObjectivesResult> {
  const filter = parseStatusFilter(status);
  if (filter === null) {
    return {
      ok: false,
      kind: "invalid",
      errors: [
        {
          field: "status",
          message: "One of all, active, paused, completed, ended.",
        },
      ],
    };
  }

  const rows = await getObjectiveRows(userId, null);
  const list = assembleList(rows, filter);
  return list.ok
    ? { ok: true, objectives: list.value }
    : { ok: false, kind: "malformed" };
}

export type GetObjectiveResult =
  | { ok: true; objective: Objective }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "malformed" };

export async function getObjective(
  userId: string,
  objectiveId: string,
): Promise<GetObjectiveResult> {
  const [row] = await getObjectiveRows(userId, objectiveId);
  if (!row) return { ok: false, kind: "not_found" };
  const objective = assembleObjective(row);
  return objective.ok
    ? { ok: true, objective: objective.value }
    : { ok: false, kind: "malformed" };
}

export type GetScheduleResult =
  | { ok: true; grid: ScheduleGrid }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "malformed" };

export async function getObjectiveSchedule(
  userId: string,
  objectiveId: string,
  from: string | null,
  to: string | null,
): Promise<GetScheduleResult> {
  const range = parseGridRange(from, to);
  if (!range.ok) return { ok: false, kind: "invalid", errors: range.error };

  const [row] = await getObjectiveRows(userId, objectiveId);
  if (!row) return { ok: false, kind: "not_found" };
  const grid = assembleGrid(row, range.value);
  return grid.ok
    ? { ok: true, grid: grid.value }
    : { ok: false, kind: "malformed" };
}

export type StatusChangeResult =
  | {
      ok: true;
      event: {
        occurred_on: string;
        change: StatusChange;
        reason: string | null;
      };
    }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "conflict"; detail: string };

/**
 * Pause, resume, complete or end: one appended event, checked against the
 * history it follows, inside one transaction with the objective locked.
 */
export async function createStatusChange(
  userId: string,
  objectiveId: string,
  body: unknown,
): Promise<StatusChangeResult> {
  const validated = validateStatusChange(body);
  if (!validated.ok) {
    return { ok: false, kind: "invalid", errors: validated.error };
  }
  const request = validated.value;
  return withTransaction(async (tx): Promise<StatusChangeResult> => {
    const history = await lockStatusHistory(tx, userId, objectiveId);
    if (!history) return { ok: false, kind: "not_found" };
    const decided = statusChange(history, request);
    if (!decided.ok) {
      return {
        ok: false,
        kind: "conflict",
        detail:
          decided.error.kind === "before_latest"
            ? `occurred_on is before the latest status change (${decided.error.latest}); the history is append-only.`
            : `A ${request.change} does not follow from ${decided.error.from ?? "no status"}.`,
      };
    }
    const event = await insertStatusEvent(
      tx,
      objectiveId,
      decided.value,
      request.occurred_on,
      request.reason,
    );
    return { ok: true, event };
  });
}
