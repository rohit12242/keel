import { getObjectiveSchedule } from "@/modules/objectives/service";
import {
  isUuid,
  jsonResponse,
  malformedRecord,
  notFound,
  problem,
  problemType,
  unavailable,
} from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/**
 * GET /objectives/{objectiveId}/schedule — the day-by-day grid, five states
 * (docs/keel-api.yaml, docs/domain/day-states.md). Computed in one read,
 * never a request per day (NFR-03). `from` / `to` default to the objective's
 * own span and are clamped to it.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ objectiveId: string }> },
): Promise<Response> {
  const { objectiveId } = await ctx.params;
  const params = new URL(req.url).searchParams;

  return withRequestLog(
    "GET /objectives/[objectiveId]/schedule",
    { objective_id: objectiveId },
    async () => {
      if (!isUuid(objectiveId)) return notFound("objective");
      try {
        const result = await getObjectiveSchedule(
          objectiveId,
          params.get("from"),
          params.get("to"),
        );
        if (result.ok) return jsonResponse(200, result.grid);
        switch (result.kind) {
          case "invalid":
            return problem(
              400,
              "Invalid range",
              problemType("invalid"),
              "One or more parameters failed validation.",
              result.errors,
            );
          case "not_found":
            return notFound("objective");
          case "malformed":
            return malformedRecord();
        }
      } catch {
        return unavailable();
      }
    },
  );
}
