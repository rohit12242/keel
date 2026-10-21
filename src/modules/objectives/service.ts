import { withTransaction } from "@/shared/db";
import type {
  Objective,
  PlanSegment,
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
import { committedMinutesPerWeek } from "./domain/committedMinutes";
import {
  extensionDecision,
  validateExtensionWrite,
} from "./domain/validateExtension";
import { canTake } from "@/modules/parking/domain/parking";
import { insertVerdict, lockIdea } from "@/modules/parking/repo";
import { localDayOf } from "@/shared/time/localDay";
import type { StatusChange } from "./domain/statusTimeline";
import {
  getObjectiveRows,
  insertObjective,
  insertSegment,
  insertStatusEvent,
  lockObjective,
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
  | { ok: false; kind: "mode_mismatch"; detail: string }
  | { ok: false; kind: "idea_unavailable"; detail: string };

/**
 * Declare an objective. Started from a parked idea, it takes the idea: the
 * idea must be the caller's and currently approved — locked or not, since an
 * early take is allowed — and its `taken` verdict, dated today in the zone
 * the objective is declared in (G37), is written in the same transaction.
 * There is no other way to take an idea.
 */
export async function createObjective(
  userId: string,
  body: unknown,
  now: Date,
): Promise<CreateObjectiveResult> {
  const validated = validateObjectiveWrite(body);
  if (!validated.ok) return validated;
  const write = validated.value;

  const created = await withTransaction(
    async (tx): Promise<{ id: string } | { refused: string }> => {
      if (write.from_parked_idea_id !== null) {
        const idea = await lockIdea(tx, userId, write.from_parked_idea_id);
        if (!idea) return { refused: "The parked idea is not one of yours." };
        if (!canTake(idea)) {
          return {
            refused:
              "The idea is not approved: it is parked, dropped or already taken.",
          };
        }
      }
      const id = await insertObjective(tx, userId, write);
      if (write.from_parked_idea_id !== null) {
        await insertVerdict(tx, userId, write.from_parked_idea_id, {
          verdict: "taken",
          occurred_on: localDayOf(now, write.tz),
          note: null,
        });
      }
      return { id };
    },
  );
  if ("refused" in created) {
    return { ok: false, kind: "idea_unavailable", detail: created.refused };
  }
  const id = created.id;

  // Read it back through the same read the list uses, so a created objective
  // and a listed one cannot differ in shape or figures.
  const [row] = await getObjectiveRows(userId, id);
  const objective = row
    ? assembleObjective(row, localDayOf(now, row.user_tz))
    : null;
  if (!objective?.ok) {
    throw new Error(`createObjective: objective ${id} did not read back`);
  }
  return { ok: true, objective: objective.value };
}

export type ListObjectivesResult =
  | {
      ok: true;
      objectives: ObjectiveSummary[];
      committed_minutes_per_week: number;
    }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "malformed" };

/**
 * The list, and what the active objectives commit per week as of today in
 * the caller's zone. With no objectives there is nothing to commit, and no
 * zone is needed.
 */
export async function listObjectives(
  userId: string,
  status: string | null,
  now: Date,
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
  // With no objectives there is nothing to read today for.
  if (rows.length === 0) {
    return { ok: true, objectives: [], committed_minutes_per_week: 0 };
  }
  const today = localDayOf(now, rows[0].user_tz);
  const list = assembleList(rows, filter, today);
  if (!list.ok) return { ok: false, kind: "malformed" };
  return {
    ok: true,
    objectives: list.value,
    committed_minutes_per_week: committedMinutesPerWeek(rows, today),
  };
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
  const objective = assembleObjective(row, localDayOf(new Date(), row.user_tz));
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

export type ExtensionResult =
  | { ok: true; segment: PlanSegment }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "conflict"; detail: string }
  | { ok: false; kind: "not_in_future"; detail: string };

/**
 * Extend the plan with a new segment, authorised by a continued plan-end
 * review. The objective is locked while the plan is read and the segment
 * written, so two extensions cannot both pass against the same plan.
 */
export async function createExtension(
  userId: string,
  objectiveId: string,
  body: unknown,
  now: Date,
): Promise<ExtensionResult> {
  const validated = validateExtensionWrite(body);
  if (!validated.ok) {
    return { ok: false, kind: "invalid", errors: validated.error };
  }
  const outcome = await withTransaction(
    async (tx): Promise<ExtensionResult | { seq: number }> => {
      if (!(await lockObjective(tx, userId, objectiveId))) {
        return { ok: false, kind: "not_found" };
      }
      const [row] = await getObjectiveRows(userId, objectiveId);
      const decided = extensionDecision(
        row,
        validated.value,
        localDayOf(now, row.user_tz),
      );
      if (!decided.ok) {
        const e = decided.error;
        return e.kind === "invalid"
          ? { ok: false, kind: "invalid", errors: [e.error] }
          : { ok: false, kind: e.kind, detail: e.detail };
      }
      await insertSegment(tx, objectiveId, decided.value);
      return { seq: decided.value.seq };
    },
  );
  if (!("seq" in outcome)) return outcome;
  const [row] = await getObjectiveRows(userId, objectiveId);
  const objective = assembleObjective(row, localDayOf(now, row.user_tz));
  if (!objective.ok) throw new Error("createExtension: did not read back");
  return {
    ok: true,
    segment: objective.value.segments.find(
      (s) => s.seq === outcome.seq,
    ) as PlanSegment,
  };
}
