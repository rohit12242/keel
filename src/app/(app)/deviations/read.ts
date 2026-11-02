import type {
  DeviationList,
  DeviationPattern,
  ObjectiveSummary,
} from "@/shared/contract";
import { thisWeek, type Week } from "@/modules/deviations/domain/deviationView";
import { readApi } from "../readApi";

export type WeekRead =
  | {
      week: Week;
      list: DeviationList;
      objectives: ObjectiveSummary[];
      patterns: DeviationPattern[];
    }
  | "signed_out"
  | "unreachable";

/**
 * The Deviations page's three reads, in parallel: this week's deviations
 * with their cost, every objective (for the names, and the dialog's
 * choices), and the patterns (for their descriptions).
 */
export async function readWeek(today: string): Promise<WeekRead> {
  const week = thisWeek(today);
  const [list, objectives, patterns] = await Promise.all([
    readApi<DeviationList>(`/deviations?from=${week.from}&to=${week.to}`),
    readApi<{ objectives: ObjectiveSummary[] }>("/objectives?status=all"),
    readApi<{ patterns: DeviationPattern[] }>("/deviation-patterns"),
  ]);
  if (list === "signed_out" || objectives === "signed_out") return "signed_out";
  if (patterns === "signed_out") return "signed_out";
  if (
    typeof list !== "object" ||
    typeof objectives !== "object" ||
    typeof patterns !== "object"
  ) {
    return "unreachable";
  }
  return {
    week,
    list: list.value,
    objectives: objectives.value.objectives,
    patterns: patterns.value.patterns,
  };
}
