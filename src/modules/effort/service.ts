import type { EffortEntry, ProblemError } from "@/shared/contract";
import { validateEffortEntryWrite } from "./domain/validateWrite";
import {
  coveringSlot,
  isDateInPlan,
} from "@/modules/objectives/domain/coveringSlot";
import { currentStatus } from "@/modules/objectives/domain/statusTimeline";
import { toSegment } from "@/modules/objectives/domain/segmentRows";
import { validateEffortEdit } from "./domain/validateEffortEdit";
import {
  deleteEffortEntry as deleteEntryRow,
  getEntryForEdit,
  getObjectiveForEffort,
  insertEffortEntry,
  updateEffortEntry as updateEntryRow,
  type EffortEntryRow,
  type ObjectiveForEffort,
} from "./repo";

/**
 * effort/service — the log-effort use case (ADR-001). Validates the body,
 * enforces the 404/422 rules, then inserts, for the signed-in user.
 */
export type CreateEffortResult =
  | { ok: true; entry: EffortEntry }
  | { ok: false; kind: "validation"; errors: ProblemError[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_active" }
  | { ok: false; kind: "outside_plan" };

function present(row: EffortEntryRow, extra: boolean): EffortEntry {
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

export async function createEffortEntry(
  userId: string,
  objectiveId: string,
  body: unknown,
): Promise<CreateEffortResult> {
  const validated = validateEffortEntryWrite(body);
  if (!validated.ok) {
    return { ok: false, kind: "validation", errors: validated.errors };
  }

  const objective = await getObjectiveForEffort(userId, objectiveId);
  if (!objective) return { ok: false, kind: "not_found" };

  // The rules are pure functions over the facts (ADR-008): the status is the
  // latest status event, and "outside the plan" is outside every segment range.
  const segments = objective.segments.map(toSegment);
  const date = validated.value.local_date;

  if (currentStatus(objective.status_events) !== "active") {
    return { ok: false, kind: "not_active" };
  }
  if (!isDateInPlan(segments, date)) {
    return { ok: false, kind: "outside_plan" };
  }

  // Derived, never stored: an entry is extra when no day slot covers its date.
  const extra = coveringSlot(segments, objective.status_events, date) === null;

  const row = await insertEffortEntry(objectiveId, validated.value);
  return { ok: true, entry: present(row, extra) };
}

/** Derived, never stored: an entry is extra when no day slot covers its date. */
const isExtra = (facts: ObjectiveForEffort, date: string): boolean =>
  coveringSlot(facts.segments.map(toSegment), facts.status_events, date) ===
  null;

export type EditEffortResult =
  | { ok: true; entry: EffortEntry }
  | { ok: false; kind: "validation"; errors: ProblemError[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_active" };

/**
 * Correct an entry. Only while its objective is running: effort on a paused,
 * completed or ended objective is the record as it stood — the same rule that
 * stops new effort being logged against it.
 */
export async function updateEffortEntry(
  userId: string,
  entryId: string,
  body: unknown,
): Promise<EditEffortResult> {
  const validated = validateEffortEdit(body);
  if (!validated.ok) {
    return { ok: false, kind: "validation", errors: validated.errors };
  }
  const found = await getEntryForEdit(userId, entryId);
  if (!found) return { ok: false, kind: "not_found" };
  if (currentStatus(found.status_events) !== "active") {
    return { ok: false, kind: "not_active" };
  }
  const row = await updateEntryRow(entryId, validated.value);
  return { ok: true, entry: present(row, isExtra(found, row.local_date)) };
}

export type DeleteEffortResult =
  | { ok: true }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_active" };

/** Delete an entry, under the same rule as an edit. */
export async function deleteEffortEntry(
  userId: string,
  entryId: string,
): Promise<DeleteEffortResult> {
  const found = await getEntryForEdit(userId, entryId);
  if (!found) return { ok: false, kind: "not_found" };
  if (currentStatus(found.status_events) !== "active") {
    return { ok: false, kind: "not_active" };
  }
  await deleteEntryRow(entryId);
  return { ok: true };
}
