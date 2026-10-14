import type { Deviation, ProblemError } from "@/shared/contract";
import { validatePatternWrite } from "./domain/validatePatternWrite";
import { toSegment } from "@/modules/objectives/domain/segmentRows";
import { localDayOf } from "@/shared/time/localDay";
import {
  costByKind,
  deviationRefusal,
  validateDeviationWrite,
  type CostTally,
} from "./domain/deviationWrite";
import { parseDeviationQuery } from "./domain/deviationQuery";
import {
  getDeviationFacts,
  insertDeviation,
  insertPattern,
  listDeviations as listDeviationRows,
  listPatterns,
  type DeviationRow,
  type PatternRow,
} from "./repo";

/**
 * deviations/service — one function per use case (ADR-001). Every function
 * takes the signed-in user's id.
 */

export const listDeviationPatterns = (userId: string): Promise<PatternRow[]> =>
  listPatterns(userId);

export type CreatePatternResult =
  | { ok: true; pattern: PatternRow }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "duplicate" };

export async function createDeviationPattern(
  userId: string,
  body: unknown,
): Promise<CreatePatternResult> {
  const validated = validatePatternWrite(body);
  if (!validated.ok) {
    return { ok: false, kind: "invalid", errors: validated.error };
  }
  return insertPattern(userId, validated.value);
}

/** The contract's Deviation: `did_instead` is left out when there was none. */
export function present(row: DeviationRow): Deviation {
  const { did_instead, ...rest } = row;
  return did_instead === null ? rest : { ...rest, did_instead };
}

export type CreateDeviationResult =
  | { ok: true; deviation: Deviation }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "refused"; detail: string };

/**
 * Record a deviation against the objectives it pulled you off. Checked
 * against the facts, then written with its objectives in one transaction.
 */
export async function createDeviation(
  userId: string,
  body: unknown,
  now: Date,
): Promise<CreateDeviationResult> {
  const validated = validateDeviationWrite(body);
  if (!validated.ok) {
    return { ok: false, kind: "invalid", errors: validated.error };
  }
  const write = validated.value;
  const facts = await getDeviationFacts(
    userId,
    write.objective_ids,
    write.pattern_id,
  );
  const refusal = deviationRefusal({
    write,
    objectives: new Map(
      facts.objectives.map((o) => [
        o.id,
        {
          segments: (o.segments ?? []).map(toSegment),
          statusEvents: o.status_events ?? [],
        },
      ]),
    ),
    patternIsTheirs: facts.pattern_is_theirs,
    today: localDayOf(now, facts.tz),
  });
  if (refusal) return { ok: false, kind: "refused", detail: refusal };
  return { ok: true, deviation: present(await insertDeviation(userId, write)) };
}

export type ListDeviationsResult =
  | {
      ok: true;
      deviations: Deviation[];
      cost: { chosen: CostTally; drifted: CostTally };
    }
  | { ok: false; kind: "invalid"; errors: ProblemError[] };

export async function listDeviations(
  userId: string,
  from: string | null,
  to: string | null,
  objectiveId: string | null,
): Promise<ListDeviationsResult> {
  const q = parseDeviationQuery(from, to, objectiveId);
  if (!q.ok) return { ok: false, kind: "invalid", errors: q.error };
  const rows = await listDeviationRows(
    userId,
    q.value.from,
    q.value.to,
    q.value.objectiveId,
  );
  return { ok: true, deviations: rows.map(present), cost: costByKind(rows) };
}
