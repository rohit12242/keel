/**
 * effort/service — one function per use case (ADR-001). Wires the pure domain
 * to the repository. May import both domain/ and repo.ts; domain/ may import
 * neither of these back.
 *
 * SCAFFOLDING STUB. A single illustrative use case so the layer exists and the
 * dependency direction is real. Real use cases land with the feature.
 */
import { adherence } from "@/modules/effort/domain/adherence";
import { entriesForDay } from "@/modules/effort/repo";
import { isErr, ok, type Result } from "@/shared/result";

export type DayAdherenceError = { readonly kind: "not_implemented" };

export async function dayAdherence(
  localDate: string,
  targetDays: number,
): Promise<Result<number, DayAdherenceError>> {
  const entries = await entriesForDay(localDate);
  if (isErr(entries)) return { ok: false, error: { kind: "not_implemented" } };

  const workedDays = entries.value.length > 0 ? 1 : 0;
  return ok(adherence(targetDays, workedDays));
}
