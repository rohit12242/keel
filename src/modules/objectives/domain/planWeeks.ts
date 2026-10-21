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
 * The run week by week (G16; docs/domain/adherence.md, *Plan weeks*): seven
 * days tiled from each segment's start, the last clipped to the segment's
 * end — the same tiling as flexible week slots and weekly review windows,
 * which is why it is `reviewWindows("weekly", …)` and not a second
 * implementation. Each week's figures are `windowFigures` over it, so a week
 * never cuts a week slot and no minute is lost. A week in progress carries its
 * whole target.
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
