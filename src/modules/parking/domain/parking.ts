import type { Note, ProblemError } from "@/shared/contract";
import { err, ok, type Result } from "@/shared/result";
import { isIsoDate } from "@/modules/effort/domain/validateWrite";
import {
  statusOn,
  type StatusEventRow,
} from "@/modules/objectives/domain/statusTimeline";

/**
 * The parking lot's rules (ADR-001 domain: pure). The lock is
 * docs/domain/parking-lock.md; this file is its one implementation.
 */

export type ObjectiveForLock = {
  segments: readonly { start_date: string; end_date: string }[];
  statusEvents: readonly StatusEventRow[];
};

/**
 * An idea is locked until everything that was running when it was caught has
 * finished: the latest current end date among the objectives active on
 * `caughtOn`, or `caughtOn` itself when none was.
 *
 * "Current end date as it stood on caughtOn" is the end of the latest segment
 * that had begun by then — an extension starts after the plan it extends, so
 * one starting later did not exist yet. An objective still active past its end
 * (its plan-end review not yet saved) has nothing left to protect, so the lock
 * never ends before the day the idea was caught.
 */
export function lockedUntil(
  caughtOn: string,
  objectives: readonly ObjectiveForLock[],
): string {
  let until = caughtOn;
  for (const o of objectives) {
    if (statusOn(o.statusEvents, caughtOn) !== "active") continue;
    const begun = o.segments.filter((s) => s.start_date <= caughtOn);
    if (begun.length === 0) continue;
    const end = begun[begun.length - 1].end_date;
    if (end > until) until = end;
  }
  return until;
}

export type IdeaWrite = { idea: string; why: string; caught_on: string };

export function validateIdeaWrite(
  input: unknown,
): Result<IdeaWrite, ProblemError[]> {
  const body =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: ProblemError[] = [];
  if (!(
    typeof body.idea === "string" &&
    body.idea.length >= 1 &&
    body.idea.length <= 300
  )) {
    errors.push({ field: "idea", message: "Required; 1–300 characters." });
  }
  if (!(
    typeof body.why === "string" &&
    body.why.length >= 1 &&
    body.why.length <= 2000
  )) {
    errors.push({ field: "why", message: "Required; 1–2000 characters." });
  }
  if (typeof body.caught_on !== "string" || !isIsoDate(body.caught_on)) {
    errors.push({ field: "caught_on", message: "Required; YYYY-MM-DD." });
  }
  if (errors.length > 0) return err(errors);
  return ok({
    idea: body.idea as string,
    why: body.why as string,
    caught_on: body.caught_on as string,
  });
}

export type VerdictWrite = {
  verdict: "parked" | "approved" | "dropped";
  occurred_on: string;
  note: string | null;
};

/**
 * `taken` is never sent: an idea is taken by starting an objective from it.
 * Whether a drop says why is a rule (verdictRefusal), not a shape.
 */
export function validateVerdictWrite(
  input: unknown,
): Result<VerdictWrite, ProblemError[]> {
  const body =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: ProblemError[] = [];
  if (
    body.verdict !== "parked" &&
    body.verdict !== "approved" &&
    body.verdict !== "dropped"
  ) {
    errors.push({
      field: "verdict",
      message:
        "Required; parked, approved or dropped. An idea is taken by starting an objective from it.",
    });
  }
  if (typeof body.occurred_on !== "string" || !isIsoDate(body.occurred_on)) {
    errors.push({ field: "occurred_on", message: "Required; YYYY-MM-DD." });
  }
  const note = body.note;
  if (
    note !== undefined &&
    note !== null &&
    (typeof note !== "string" || note.length > 2000)
  ) {
    errors.push({ field: "note", message: "Up to 2000 characters." });
  }
  if (errors.length > 0) return err(errors);
  return ok({
    verdict: body.verdict as VerdictWrite["verdict"],
    occurred_on: body.occurred_on as string,
    note: typeof note === "string" && note.length > 0 ? note : null,
  });
}

export type VerdictRow = {
  verdict: "parked" | "approved" | "taken" | "dropped";
  note: string | null;
  occurred_on: string;
};

export type IdeaRow = {
  id: string;
  idea: string;
  why: string;
  caught_on: string;
  locked_until: string;
  /** Oldest first: by occurred_on, then as recorded. */
  verdicts: VerdictRow[];
  /** Oldest first: by written_on, then as recorded. */
  notes: Note[];
  became_objective_id: string | null;
};

export type ParkedIdea = {
  id: string;
  idea: string;
  why: string;
  caught_on: string;
  locked_until: string;
  locked: boolean;
  notes: Note[];
  verdict: VerdictRow["verdict"];
  note: string | null;
  became_objective_id: string | null;
  decided_early: boolean;
};

/** The verdict as it stood on `date`: the latest row on or before it. */
export function verdictOn(
  verdicts: readonly VerdictRow[],
  date: string,
): VerdictRow | null {
  let found: VerdictRow | null = null;
  for (const v of verdicts) if (v.occurred_on <= date) found = v;
  return found;
}

const isFinal = (v: VerdictRow) =>
  v.verdict === "taken" || v.verdict === "dropped";

/**
 * An idea as the contract shows it. The current verdict is the latest row —
 * except that dropped and taken are final (invariant 13): once there is one,
 * that is what the idea is, whatever is dated around it. The lock lifts on
 * `locked_until`: the idea opens that day. `decided_early` — a decision given
 * before the lock lifted — is computed, never stored; a parked idea is never
 * early (docs/domain/parking-lock.md).
 */
export function assembleIdea(row: IdeaRow, today: string): ParkedIdea {
  const final = row.verdicts.find(isFinal);
  const current = final ?? row.verdicts[row.verdicts.length - 1];
  return {
    id: row.id,
    idea: row.idea,
    why: row.why,
    caught_on: row.caught_on,
    locked_until: row.locked_until,
    locked: today < row.locked_until,
    notes: row.notes,
    verdict: current.verdict,
    note: current.note,
    became_objective_id: row.became_objective_id,
    decided_early:
      current.verdict !== "parked" && current.occurred_on < row.locked_until,
  };
}

export type VerdictRefusal = "final" | "needs_reason" | "future";

/**
 * Why a well-formed verdict cannot be recorded, or null. The lock refuses
 * nothing: a verdict before it lifts is recorded, and shown as early.
 *
 * - `final`: the idea was dropped or taken; nothing follows (the 409).
 * - `needs_reason`: a drop says why it ended (the 422).
 * - `future`: a verdict is given once it has happened (the 422).
 */
export function verdictRefusal(
  row: IdeaRow,
  write: VerdictWrite,
  today: string,
): VerdictRefusal | null {
  if (row.verdicts.some(isFinal)) return "final";
  if (write.verdict === "dropped" && write.note === null) return "needs_reason";
  if (write.occurred_on > today) return "future";
  return null;
}

/**
 * Whether an idea can be taken — an objective started from it. Only an idea
 * that is currently approved (invariant 13): a parked one is approved first,
 * and a dropped or taken one is final. A lock does not stop it: taking early
 * is allowed, and shown as early (docs/domain/parking-lock.md).
 */
export function canTake(row: IdeaRow): boolean {
  return assembleIdea(row, row.caught_on).verdict === "approved";
}
