import { createStatusChange } from "@/modules/objectives/service";
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
 * POST /v1/objectives/{objectiveId}/status-changes — pause, resume, complete
 * or end. Append-only: a change that does not follow, or one dated before the
 * latest, is a 409.
 */
export const POST = withSession(
  async (
    req: Request,
    ctx: { params: Promise<{ objectiveId: string }> },
    userId: string,
  ): Promise<Response> => {
    const { objectiveId } = await ctx.params;
    return withRequestLog(
      "POST /v1/objectives/[objectiveId]/status-changes",
      { objective_id: objectiveId },
      async () => {
        if (!isUuid(objectiveId)) return notFound("objective");
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return problem(
            400,
            "Invalid request",
            problemType("invalid"),
            "The request body must be JSON.",
          );
        }
        try {
          const result = await createStatusChange(userId, objectiveId, body);
          if (result.ok) return jsonResponse(201, result.event);
          switch (result.kind) {
            case "invalid":
              return problem(
                400,
                "Invalid status change",
                problemType("invalid"),
                "One or more fields failed validation.",
                result.errors,
              );
            case "not_found":
              return notFound("objective");
            case "conflict":
              return problem(
                409,
                "That change does not follow",
                problemType("status-change-conflict"),
                result.detail,
              );
          }
        } catch {
          return unavailable();
        }
      },
    );
  },
);
