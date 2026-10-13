import { query } from "@/shared/db";
import type { PatternWrite } from "./domain/validatePatternWrite";

/**
 * deviations/repo — the only file in this module with SQL (ADR-001). Every
 * table here carries user_id, and every read filters by it (NFR-10).
 */

export type PatternRow = {
  id: string;
  name: string;
  description: string | null;
  occurrences: number;
};

/** The caller's patterns, each with how many deviations name it. One query. */
export async function listPatterns(userId: string): Promise<PatternRow[]> {
  const res = await query<PatternRow>(
    `SELECT p.id, p.name, p.description,
            (SELECT count(*)::int FROM deviation d WHERE d.pattern_id = p.id)
              AS occurrences
     FROM deviation_pattern p
     WHERE p.user_id = $1
     ORDER BY lower(p.name), p.id`,
    [userId],
  );
  return res.rows;
}

export type InsertPattern =
  { ok: true; pattern: PatternRow } | { ok: false; kind: "duplicate" };

/** A new pattern. The unique index decides a duplicate name, not a lookup. */
export async function insertPattern(
  userId: string,
  p: PatternWrite,
): Promise<InsertPattern> {
  try {
    const res = await query<PatternRow>(
      `INSERT INTO deviation_pattern (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, 0 AS occurrences`,
      [userId, p.name, p.description],
    );
    return { ok: true, pattern: res.rows[0] };
  } catch (e) {
    const pgErr = e as { code?: string; constraint?: string };
    if (
      pgErr.code === "23505" &&
      pgErr.constraint === "deviation_pattern_user_name_key"
    ) {
      return { ok: false, kind: "duplicate" };
    }
    throw e;
  }
}
