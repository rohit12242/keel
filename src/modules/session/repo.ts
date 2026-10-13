import { query } from "@/shared/db";
import type { Identity } from "./domain/session";

/**
 * session/repo — the only file in this module with SQL (ADR-001). The user
 * row, found by the provider's subject or created for it (ERD, *User*).
 */

export async function findUserBySubject(
  subject: string,
): Promise<{ id: string } | null> {
  const res = await query<{ id: string }>(
    `SELECT id FROM "user" WHERE idp_subject = $1`,
    [subject],
  );
  return res.rows[0] ?? null;
}

export type CreateUser =
  { ok: true; id: string } | { ok: false; kind: "email_taken" };

/**
 * Create the user for a first sign-in. The unique constraints decide, not a
 * prior lookup, so two sign-ins racing cannot both pass a check:
 *
 * - the same subject twice (a double-clicked callback): the second insert
 *   writes nothing and the row the first one wrote is used;
 * - an email that already belongs to another subject — a provider account
 *   deleted and recreated: refused, nothing written.
 *
 * `tz` is UTC until the user has a way to say otherwise: the sign-in carries
 * no zone, and every recorded date comes from the client anyway (NFR-12).
 */
export async function createUser(identity: Identity): Promise<CreateUser> {
  try {
    const res = await query<{ id: string }>(
      `INSERT INTO "user" (email, tz, idp_subject)
       VALUES ($1, 'UTC', $2)
       ON CONFLICT (idp_subject) DO NOTHING
       RETURNING id`,
      [identity.email, identity.subject],
    );
    if (res.rows[0]) return { ok: true, id: res.rows[0].id };
  } catch (e) {
    const pgErr = e as { code?: string; constraint?: string };
    if (pgErr.code === "23505" && pgErr.constraint === "user_email_key") {
      return { ok: false, kind: "email_taken" };
    }
    throw e;
  }

  const existing = await findUserBySubject(identity.subject);
  if (!existing) throw new Error("user row vanished after a subject conflict");
  return { ok: true, id: existing.id };
}
