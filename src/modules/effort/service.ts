import { getConfig } from "@/config/env";
import type { EffortEntry, ProblemError } from "@/shared/contract";
import { validateEffortEntryWrite } from "./domain/validateWrite";
import {
  checkObjectiveForEffort,
  insertEffortEntry,
  type EffortEntryRow,
} from "./repo";

/**
 * effort/service — the log-effort use case (ADR-001). Validates the body,
 * enforces the 404/422 rules, then inserts. The current user is the seeded
 * user until auth (E-06).
 */
export type CreateEffortResult =
  | { ok: true; entry: EffortEntry }
  | { ok: false; kind: "validation"; errors: ProblemError[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_active" }
  | { ok: false; kind: "outside_plan" };

function present(row: EffortEntryRow): EffortEntry {
  const entry: EffortEntry = {
    id: row.id,
    objective_id: row.objective_id,
    local_date: row.local_date,
    tz: row.tz,
    minutes: row.minutes,
    note: row.note,
    link: row.link,
    logged_at: row.logged_at,
    extra: row.extra,
  };
  if (row.occurred_at_local) entry.occurred_at_local = row.occurred_at_local;
  return entry;
}

export async function createEffortEntry(
  objectiveId: string,
  body: unknown,
): Promise<CreateEffortResult> {
  const validated = validateEffortEntryWrite(body);
  if (!validated.ok) {
    return { ok: false, kind: "validation", errors: validated.errors };
  }

  const { seedUserId } = getConfig();
  const check = await checkObjectiveForEffort(
    seedUserId,
    objectiveId,
    validated.value.local_date,
  );
  if (!check) return { ok: false, kind: "not_found" };
  if (check.status !== "active") return { ok: false, kind: "not_active" };
  if (!check.date_covered) return { ok: false, kind: "outside_plan" };

  const row = await insertEffortEntry(objectiveId, validated.value);
  return { ok: true, entry: present(row) };
}
