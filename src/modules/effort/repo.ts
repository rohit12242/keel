/**
 * effort/repo — the only file in this module allowed to speak SQL (ADR-001).
 *
 * SCAFFOLDING STUB. No database exists yet (W3-12 owns migrations and the
 * client). This file exists so the import-boundary rule has a `repo.ts` to
 * forbid domain/ from importing, and so the service layer has something to
 * depend on. It intentionally has no query in it yet.
 */
import type { Result } from "@/shared/result";

export type EffortEntry = {
  readonly localDate: string; // YYYY-MM-DD, sent by the client (NFR-12, kept half)
  readonly minutes: number;
};

export type RepoError = { readonly kind: "not_implemented" };

export async function entriesForDay(
  localDate: string,
): Promise<Result<EffortEntry[], RepoError>> {
  throw new Error(
    `effort/repo: entriesForDay(${localDate}) not implemented until W3-12`,
  );
}
