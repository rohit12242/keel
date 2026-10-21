import type { Figures } from "@/shared/contract";

/**
 * On track · At risk · Behind (G15; docs/domain/adherence.md, *Track*): one
 * band over the adherence to date, so the list, the Overview and Today agree.
 * Before any slot has ended there is nothing to judge, and no band.
 */
export type Track = "on_track" | "at_risk" | "behind";

export function trackOf(
  toDate: Pick<Figures, "adherence_pct">,
  anyEnded: boolean,
): Track | null {
  if (!anyEnded) return null;
  if (toDate.adherence_pct >= 80) return "on_track";
  if (toDate.adherence_pct >= 60) return "at_risk";
  return "behind";
}
