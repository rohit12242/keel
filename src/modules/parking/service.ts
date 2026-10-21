import type { ProblemError } from "@/shared/contract";
import { withTransaction } from "@/shared/db";
import { localDayOf } from "@/shared/time/localDay";
import {
  assembleIdea,
  lockedUntil,
  validateIdeaWrite,
  validateVerdictWrite,
  verdictRefusal,
  type ParkedIdea,
} from "./domain/parking";
import {
  getLockFacts,
  insertIdea,
  insertVerdict,
  listIdeas,
  lockIdea,
} from "./repo";

/**
 * parking/service — the parking lot (ADR-001). "Today", against which a lock
 * is lifted or not, is read in the caller's zone.
 */

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
  const until = lockedUntil(
    validated.value.caught_on,
    facts.objectives.map((o) => ({
      segments: o.segments ?? [],
      statusEvents: o.status_events ?? [],
    })),
  );
  const row = await insertIdea(userId, validated.value, until);
  return { ok: true, idea: assembleIdea(row, localDayOf(now, facts.tz)) };
}

export async function listParkedIdeas(
  userId: string,
  now: Date,
): Promise<ParkedIdea[]> {
  const { tz, ideas } = await listIdeas(userId);
  const today = localDayOf(now, tz);
  return ideas.map((row) => assembleIdea(row, today));
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
