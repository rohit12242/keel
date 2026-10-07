import { getObjective } from "@/modules/objectives/service";
import {
  isUuid,
  jsonResponse,
  malformedRecord,
  notFound,
  unavailable,
} from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/**
 * GET /objectives/{objectiveId} — one objective, with its segments, its
 * status history and its whole-run figures (docs/keel-api.yaml). Another
 * user's objective is a 404, not a 403 (NFR-10).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ objectiveId: string }> },
): Promise<Response> {
  const { objectiveId } = await ctx.params;

  return withRequestLog(
    "GET /objectives/[objectiveId]",
    { objective_id: objectiveId },
    async () => {
      if (!isUuid(objectiveId)) return notFound("objective");
      try {
        const result = await getObjective(objectiveId);
        if (result.ok) return jsonResponse(200, result.objective);
        switch (result.kind) {
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
