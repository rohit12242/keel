import { listObjectiveEffort } from "@/modules/effort/service";
import {
  isUuid,
  jsonResponse,
  notFound,
  problem,
  problemType,
  unavailable,
  withSession,
} from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/**
 * GET /v1/objectives/{objectiveId}/effort?month=YYYY-MM — the Effort tab:
 * every session, month by month, with the planned days that had none.
 * Read-only; entries are edited from Today.
 */
export const GET = withSession(
  async (
    req: Request,
    ctx: { params: Promise<{ objectiveId: string }> },
    userId: string,
  ): Promise<Response> => {
    const { objectiveId } = await ctx.params;
    const month = new URL(req.url).searchParams.get("month");
    return withRequestLog(
      "GET /v1/objectives/[objectiveId]/effort",
      { objective_id: objectiveId },
      async () => {
        if (!isUuid(objectiveId)) return notFound("objective");
        try {
          const result = await listObjectiveEffort(
            userId,
            objectiveId,
            month,
            new Date(),
          );
          if (result.ok) return jsonResponse(200, result.month);
          return result.kind === "invalid"
            ? problem(
                400,
                "Invalid month",
                problemType("invalid"),
                "One or more parameters failed validation.",
                result.errors,
              )
            : notFound("objective");
        } catch {
          return unavailable();
        }
      },
    );
  },
);
