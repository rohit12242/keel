import type { EffortEntry, ProblemError } from "@/shared/contract";
import { withTransaction } from "@/shared/db";
import {
  overlapping,
  parseDateRange,
  spanLabel,
  validateEffortEntryWrite,
} from "./domain/validateWrite";
import {
  coveringSlot,
  isDateInPlan,
} from "@/modules/objectives/domain/coveringSlot";
import { currentStatus } from "@/modules/objectives/domain/statusTimeline";
import { toSegment } from "@/modules/objectives/domain/segmentRows";
import { validateEffortEdit } from "./domain/validateEffortEdit";
import { effortDayRefusal, futureRefusal } from "./domain/effortDay";
import {
  effortMonth,
  parseMonth,
  type EffortMonth,
} from "./domain/effortMonth";
import { localDayOf, localTimeOf } from "@/shared/time/localDay";
import {
  deleteEffortEntry as deleteEntryRow,
  getEffortMonthFacts,
  getEntriesInRange,
  getEntryForEdit,
  getObjectiveForEffort,
  insertEffortEntry,
  lockUserDay,
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
  | { ok: false; kind: "not_today" }
  | { ok: false; kind: "in_future" }
  | { ok: false; kind: "not_active" }
  | { ok: false; kind: "outside_plan" }
  | { ok: false; kind: "overlap"; detail: string };

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
    occurred_at_local: row.occurred_at_local,
  };
  return entry;
}

export async function createEffortEntry(
  userId: string,
  objectiveId: string,
  body: unknown,
  now: Date,
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

  // Logged only for today, in the zone the client says it is in (G21).
  if (effortDayRefusal(date, localDayOf(now, validated.value.tz))) {
    return { ok: false, kind: "not_today" };
  }
  // ...and only once it has happened, on that zone's clock.
  if (futureRefusal(validated.value, localTimeOf(now, validated.value.tz))) {
    return { ok: false, kind: "in_future" };
  }

  if (currentStatus(objective.status_events) !== "active") {
    return { ok: false, kind: "not_active" };
  }
  if (!isDateInPlan(segments, date)) {
    return { ok: false, kind: "outside_plan" };
  }

  // Derived, never stored: an entry is extra when no day slot covers its date.
  const extra = coveringSlot(segments, objective.status_events, date) === null;

  // No two of the user's entries on one day overlap, under any objective
  // (invariant 18): checked and written under the user's row lock.
  const written = await withTransaction(async (tx) => {
    const day = await lockUserDay(tx, userId, date, null);
    const hit = overlapping(validated.value, day);
    if (hit) return { written: false as const, hit };
    return {
      written: true as const,
      row: await insertEffortEntry(tx, objectiveId, validated.value),
    };
  });
  if (!written.written) {
    return { ok: false, kind: "overlap", detail: overlapDetail(written.hit) };
  }
  return { ok: true, entry: present(written.row, extra) };
}

const overlapDetail = (hit: { occurred_at_local: string; minutes: number }) =>
  `Overlaps ${spanLabel(hit)}. Change the times.`;

/** Derived, never stored: an entry is extra when no day slot covers its date. */
const isExtra = (facts: ObjectiveForEffort, date: string): boolean =>
  coveringSlot(facts.segments.map(toSegment), facts.status_events, date) ===
  null;

export type EditEffortResult =
  | { ok: true; entry: EffortEntry }
  | { ok: false; kind: "validation"; errors: ProblemError[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_today" }
  | { ok: false; kind: "in_future" }
  | { ok: false; kind: "not_active" }
  | { ok: false; kind: "overlap"; detail: string };

/**
 * Correct an entry. Only on its own day, in the zone it was logged in (G21),
 * and only while its objective is running: effort on a paused, completed or
 * ended objective is the record as it stood — the same rule that stops new
 * effort being logged against it.
 */
export async function updateEffortEntry(
  userId: string,
  entryId: string,
  body: unknown,
  now: Date,
): Promise<EditEffortResult> {
  const validated = validateEffortEdit(body);
  if (!validated.ok) {
    return { ok: false, kind: "validation", errors: validated.errors };
  }
  const found = await getEntryForEdit(userId, entryId);
  if (!found) return { ok: false, kind: "not_found" };
  if (effortDayRefusal(found.local_date, localDayOf(now, found.tz))) {
    return { ok: false, kind: "not_today" };
  }
  if (currentStatus(found.status_events) !== "active") {
    return { ok: false, kind: "not_active" };
  }
  // The span as it will stand, checked against the user's other entries that
  // day — the entry itself left out.
  const span = {
    occurred_at_local:
      validated.value.occurred_at_local ?? found.occurred_at_local,
    minutes: validated.value.minutes ?? found.minutes,
  };
  if (futureRefusal(span, localTimeOf(now, found.tz))) {
    return { ok: false, kind: "in_future" };
  }
  const written = await withTransaction(async (tx) => {
    const day = await lockUserDay(tx, userId, found.local_date, entryId);
    const hit = overlapping(span, day);
    if (hit) return { written: false as const, hit };
    return {
      written: true as const,
      row: await updateEntryRow(tx, entryId, validated.value),
    };
  });
  if (!written.written) {
    return { ok: false, kind: "overlap", detail: overlapDetail(written.hit) };
  }
  return {
    ok: true,
    entry: present(written.row, isExtra(found, written.row.local_date)),
  };
}

export type DeleteEffortResult =
  | { ok: true }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_today" }
  | { ok: false; kind: "not_active" };

/** Delete an entry, under the same rules as an edit. */
export async function deleteEffortEntry(
  userId: string,
  entryId: string,
  now: Date,
): Promise<DeleteEffortResult> {
  const found = await getEntryForEdit(userId, entryId);
  if (!found) return { ok: false, kind: "not_found" };
  if (effortDayRefusal(found.local_date, localDayOf(now, found.tz))) {
    return { ok: false, kind: "not_today" };
  }
  if (currentStatus(found.status_events) !== "active") {
    return { ok: false, kind: "not_active" };
  }
  await deleteEntryRow(entryId);
  return { ok: true };
}

export type EffortMonthResult =
  | { ok: true; month: EffortMonth }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "not_found" };

/**
 * The Effort tab for one month. Read-only; one query. "Today" — the last day
 * a planned day can have been missed — is read in the caller's zone.
 */
export async function listObjectiveEffort(
  userId: string,
  objectiveId: string,
  month: string | null,
  now: Date,
): Promise<EffortMonthResult> {
  const range = parseMonth(month);
  if (!range.ok) return { ok: false, kind: "invalid", errors: range.error };
  const facts = await getEffortMonthFacts(userId, objectiveId);
  if (!facts) return { ok: false, kind: "not_found" };
  return {
    ok: true,
    month: effortMonth({
      month: month as string,
      range: range.value,
      today: localDayOf(now, facts.tz),
      segments: facts.segments.map(toSegment),
      statusEvents: facts.status_events,
      entries: facts.entries,
    }),
  };
}

export type ListEntriesResult =
  | { ok: true; entries: EffortEntry[] }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "not_found" };

/**
 * An objective's entries over a range, with their times (G18): the Effort
 * tab's last day and week dialog, in one call rather than one per day.
 * Read-only — entries are edited from Today.
 */
export async function listObjectiveEntries(
  userId: string,
  objectiveId: string,
  from: string | null,
  to: string | null,
): Promise<ListEntriesResult> {
  const range = parseDateRange(from, to);
  if (!range.ok) return { ok: false, kind: "invalid", errors: range.errors };
  const facts = await getEntriesInRange(
    userId,
    objectiveId,
    range.from,
    range.to,
  );
  if (!facts) return { ok: false, kind: "not_found" };
  return {
    ok: true,
    entries: facts.entries.map((row) =>
      present(row, isExtra(facts, row.local_date)),
    ),
  };
}
