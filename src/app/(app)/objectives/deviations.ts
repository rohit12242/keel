import type { DeviationList, ObjectiveSummary } from "@/shared/contract";
import { readApi, type Read } from "../readApi";

/**
 * The open objective's deviations, with their cost: one read over its whole
 * plan. Every deviation falls inside it — the API refuses one dated outside
 * (422) — so this is all of them. The tab's count, its weeks and So far's
 * Deviation time all come from it.
 */
export const readDeviations = (
  o: Pick<ObjectiveSummary, "id" | "start_date" | "end_date">,
): Promise<Read<DeviationList>> =>
  readApi<DeviationList>(
    `/deviations?objective_id=${o.id}&from=${o.start_date}&to=${o.end_date}`,
  );
