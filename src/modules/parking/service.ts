import type { Note, ProblemError } from "@/shared/contract";
import {
  noteRefusal,
  validateNoteWrite,
} from "@/modules/objectives/domain/noteWrite";
import { withTransaction } from "@/shared/db";
import { localDayOf } from "@/shared/time/localDay";
import { isIsoDate } from "@/modules/effort/domain/validateWrite";
import {
  assembleIdea,
  lockedUntil,
  validateIdeaWrite,
  validateVerdictWrite,
  verdictRefusal,
  type ParkedIdea,
} from "./domain/parking";
import {
  getIdeaNoteFacts,
  getLockFacts,
  insertIdea,
  insertIdeaNote,
  insertVerdict,
  listIdeas,
  lockIdea,
  type LockFacts,
} from "./repo";

/**
 * parking/service — the parking lot (ADR-001). "Today", against which a lock
 * is lifted or not, is read in the caller's zone.
 */

/** The lock rule's view of the caller's objectives. */
const lockObjectives = (facts: LockFacts) =>
  facts.objectives.map((o) => ({
    segments: o.segments ?? [],
    statusEvents: o.status_events ?? [],
  }));

export type ParkResult =
  | { ok: true; idea: ParkedIdea }
  | { ok: false; kind: "invalid"; errors: ProblemError[] };

/** Park an idea. The server sets the lock (docs/domain/parking-lock.md). */
export async function createParkedIdea(
  userId: string,
  body: unknown,
  now: Date,
): Promise<ParkResult> {
  const validated = validateIdeaWrite(body);
  if (!validated.ok) {
    return { ok: false, kind: "invalid", errors: validated.error };
  }
  const facts = await getLockFacts(userId);
  const until = lockedUntil(validated.value.caught_on, lockObjectives(facts));
  const row = await insertIdea(userId, validated.value, until);
  return { ok: true, idea: assembleIdea(row, localDayOf(now, facts.tz)) };
}

export type ListIdeasResult =
  | {
      ok: true;
      ideas: ParkedIdea[];
      new_idea_locked_until?: string;
    }
  | { ok: false; kind: "invalid"; errors: ProblemError[] };

/**
 * The parking lot, one query. With `caughtOn`, also the lock an idea caught
 * that day would get (G38) — the same rule that sets it when the idea is
 * parked, so the dialog and the stored lock cannot disagree. That costs a
 * second, fixed query, only when asked for.
 */
export async function listParkedIdeas(
  userId: string,
  now: Date,
  caughtOn: string | null,
): Promise<ListIdeasResult> {
  if (caughtOn !== null && !isIsoDate(caughtOn)) {
    return {
      ok: false,
      kind: "invalid",
      errors: [{ field: "caught_on", message: "YYYY-MM-DD." }],
    };
  }
  const { tz, ideas } = await listIdeas(userId);
  const today = localDayOf(now, tz);
  const list = ideas.map((row) => assembleIdea(row, today));
  if (caughtOn === null) return { ok: true, ideas: list };
  return {
    ok: true,
    ideas: list,
    new_idea_locked_until: lockedUntil(
      caughtOn,
      lockObjectives(await getLockFacts(userId)),
    ),
  };
}

export type VerdictResult =
  | { ok: true; idea: ParkedIdea }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "final" }
  | { ok: false; kind: "needs_reason" }
  | { ok: false; kind: "future" };

/** Give or change a verdict: appended, never edited (invariant 13). */
export async function createParkedIdeaVerdict(
  userId: string,
  ideaId: string,
  body: unknown,
  now: Date,
): Promise<VerdictResult> {
  const validated = validateVerdictWrite(body);
  if (!validated.ok) {
    return { ok: false, kind: "invalid", errors: validated.error };
  }
  const { tz } = await getLockFacts(userId);
  const today = localDayOf(now, tz);
  return withTransaction(async (tx): Promise<VerdictResult> => {
    const idea = await lockIdea(tx, userId, ideaId);
    if (!idea) return { ok: false, kind: "not_found" };
    const refusal = verdictRefusal(idea, validated.value, today);
    if (refusal) return { ok: false, kind: refusal };
    const row = await insertVerdict(tx, userId, ideaId, validated.value);
    return { ok: true, idea: assembleIdea(row, today) };
  });
}

export type IdeaNoteResult =
  | { ok: true; note: Note }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "future" };

/**
 * Add a note to a parked idea, in any state — dropped and taken included
 * (G3). Shape, then owner, then date, as for an objective's note.
 */
export async function createParkedIdeaNote(
  userId: string,
  ideaId: string,
  body: unknown,
  now: Date,
): Promise<IdeaNoteResult> {
  const validated = validateNoteWrite(body);
  if (!validated.ok) {
    return { ok: false, kind: "invalid", errors: validated.error };
  }
  const facts = await getIdeaNoteFacts(userId, ideaId);
  if (!facts.owned) return { ok: false, kind: "not_found" };
  if (noteRefusal(validated.value.written_on, localDayOf(now, facts.tz))) {
    return { ok: false, kind: "future" };
  }
  const note = await insertIdeaNote(userId, ideaId, validated.value);
  return note ? { ok: true, note } : { ok: false, kind: "not_found" };
}
