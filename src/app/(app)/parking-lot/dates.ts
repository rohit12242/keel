import type { ObjectiveSummary } from "@/shared/contract";
import type { ObjectiveDates } from "@/modules/parking/domain/parkingView";

/** What the Parking lot needs of each objective. */
export const datesOf = (objectives: readonly ObjectiveSummary[]) =>
  objectives.map((o): ObjectiveDates => ({
    id: o.id,
    title: o.title,
    start_date: o.start_date,
    end_date: o.end_date,
  }));
