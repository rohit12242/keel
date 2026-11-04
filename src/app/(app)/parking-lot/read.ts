import type { ObjectiveSummary, ParkedIdeaList } from "@/shared/contract";
import { readApi } from "../readApi";

export type LotRead =
  | {
      ideas: ParkedIdeaList["ideas"];
      /** Every objective: a Taken idea's dates, the lock's name, `D`'s choices. */
      objectives: ObjectiveSummary[];
    }
  | "signed_out"
  | "unreachable";

/**
 * The Parking lot's two reads, in parallel: every idea, newest caught
 * first with its notes (one read, NFR-03), and every objective.
 */
export async function readLot(): Promise<LotRead> {
  const [list, objectives] = await Promise.all([
    readApi<ParkedIdeaList>("/parked-ideas"),
    readApi<{ objectives: ObjectiveSummary[] }>("/objectives?status=all"),
  ]);
  if (list === "signed_out" || objectives === "signed_out") return "signed_out";
  if (typeof list !== "object" || typeof objectives !== "object") {
    return "unreachable";
  }
  return { ideas: list.value.ideas, objectives: objectives.value.objectives };
}
