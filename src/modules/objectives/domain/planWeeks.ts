import type { Figures } from "@/shared/contract";
import {
  windowFigures,
  type DailyMinutes,
} from "@/modules/effort/domain/adherence";
import type { PlannedSlot } from "./planSlots";
import {
  reviewWindows,
  type SegmentSpan,
} from "@/modules/reviews/domain/reviewWindows";

/**
 * The run week by week (G16; docs/domain/adherence.md, *Plan weeks*):
 * Monday-to-Sunday weeks clipped to each segment, a short first or last week
 * joined to its neighbour (I-09) — the weekly review windows, which is why it
 * is `reviewWindows("weekly", …)` and not a second implementation, and "Week 2"
 * means the same days everywhere. Each week's figures are `windowFigures` over
 * it. A week in progress carries its whole target.
 */
export type PlanWeek = {
  period_start: string;
  period_end: string;
  figures: Required<Figures>;
};

export function planWeeks(
  segments: readonly SegmentSpan[],
  slots: readonly PlannedSlot[],
  daily: DailyMinutes,
): PlanWeek[] {
  return segments
    .flatMap((s) => reviewWindows("weekly", s))
    .map(({ period_start, period_end }) => ({
      period_start,
      period_end,
      figures: windowFigures({ period_start, period_end }, slots, daily),
    }));
}
