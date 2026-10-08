import { getConfig } from "@/config/env";
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
import { getObjectiveRows, insertObjective } from "./repo";

/**
 * objectives/service — one function per use case (ADR-001). Each read is one
 * repository call, so one query (NFR-03's reason); the rules are in domain/.
 * The current user is the seeded user until auth (E-06).
 *
 * `malformed` is an objective whose stored facts have no status or no plan:
 * a read fails rather than guessing (ERD invariant 16).
 */

export type CreateObjectiveResult =
  | { ok: true; objective: Objective }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "mode_mismatch"; detail: string };

export async function createObjective(
  body: unknown,
): Promise<CreateObjectiveResult> {
  const validated = validateObjectiveWrite(body);
  if (!validated.ok) return validated;

  const { seedUserId } = getConfig();
  const id = await withTransaction((tx) =>
    insertObjective(tx, seedUserId, validated.value),
  );

  // Read it back through the same read the list uses, so a created objective
  // and a listed one cannot differ in shape or figures.
  const [row] = await getObjectiveRows(seedUserId, id);
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

  const rows = await getObjectiveRows(getConfig().seedUserId, null);
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
  objectiveId: string,
): Promise<GetObjectiveResult> {
  const [row] = await getObjectiveRows(getConfig().seedUserId, objectiveId);
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
  objectiveId: string,
  from: string | null,
  to: string | null,
): Promise<GetScheduleResult> {
  const range = parseGridRange(from, to);
  if (!range.ok) return { ok: false, kind: "invalid", errors: range.error };

  const [row] = await getObjectiveRows(getConfig().seedUserId, objectiveId);
  if (!row) return { ok: false, kind: "not_found" };
  const grid = assembleGrid(row, range.value);
  return grid.ok
    ? { ok: true, grid: grid.value }
    : { ok: false, kind: "malformed" };
}
