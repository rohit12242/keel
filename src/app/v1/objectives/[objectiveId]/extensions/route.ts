import { createExtension } from "@/modules/objectives/service";
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
 * POST /v1/objectives/{objectiveId}/extensions — a new plan segment,
 * authorised by a continued plan-end review, ending strictly after today.
 */
export const POST = withSession(
  async (
    req: Request,
    ctx: { params: Promise<{ objectiveId: string }> },
    userId: string,
  ): Promise<Response> => {
    const { objectiveId } = await ctx.params;
    return withRequestLog(
      "POST /v1/objectives/[objectiveId]/extensions",
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
          const result = await createExtension(
            userId,
            objectiveId,
            body,
            new Date(),
          );
          if (result.ok) return jsonResponse(201, result.segment);
          switch (result.kind) {
            case "invalid":
              return problem(
                400,
                "Invalid extension",
                problemType("invalid"),
                "One or more fields failed validation.",
                result.errors,
              );
            case "not_found":
              return notFound("objective");
            case "conflict":
              return problem(
                409,
                "This extension is not authorised",
                problemType("extension-not-authorised"),
                result.detail,
              );
            case "fixed_only":
              return problem(
                422,
                "v1 plans fixed objectives only",
                problemType("fixed-only"),
                result.detail,
              );
            case "not_in_future":
              return problem(
                422,
                "The extension must end after today",
                problemType("extension-not-in-future"),
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
