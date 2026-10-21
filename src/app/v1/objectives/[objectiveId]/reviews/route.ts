import { listReviews, startReview } from "@/modules/reviews/service";
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

type Ctx = { params: Promise<{ objectiveId: string }> };

/** GET /v1/objectives/{objectiveId}/reviews — the Reviews tab. */
export const GET = withSession(
  async (_req: Request, ctx: Ctx, userId: string): Promise<Response> => {
    const { objectiveId } = await ctx.params;
    return withRequestLog(
      "GET /v1/objectives/[objectiveId]/reviews",
      { objective_id: objectiveId },
      async () => {
        if (!isUuid(objectiveId)) return notFound("objective");
        try {
          const listed = await listReviews(userId, objectiveId, new Date());
          return listed ? jsonResponse(200, listed) : notFound("objective");
        } catch {
          return unavailable();
        }
      },
    );
  },
);

/**
 * POST /v1/objectives/{objectiveId}/reviews — start or resume. No body: the
 * period due now (422 when none is). 201 the first time, 200 after.
 */
export const POST = withSession(
  async (req: Request, ctx: Ctx, userId: string): Promise<Response> => {
    const { objectiveId } = await ctx.params;
    return withRequestLog(
      "POST /v1/objectives/[objectiveId]/reviews",
      { objective_id: objectiveId },
      async () => {
        if (!isUuid(objectiveId)) return notFound("objective");
        let body: unknown = undefined;
        const text = await req.text();
        if (text.trim() !== "") {
          try {
            body = JSON.parse(text);
          } catch {
            return problem(
              400,
              "Invalid request",
              problemType("invalid"),
              "The request body must be JSON, or absent.",
            );
          }
        }
        try {
          const result = await startReview(
            userId,
            objectiveId,
            body,
            new Date(),
          );
          if (result.ok) {
            return jsonResponse(result.created ? 201 : 200, result.review);
          }
          switch (result.kind) {
            case "invalid":
              return problem(
                400,
                "Invalid period",
                problemType("invalid"),
                "One or more fields failed validation.",
                result.errors,
              );
            case "not_found":
              return notFound("objective");
            case "saved":
              return problem(
                409,
                "This period is already reviewed",
                problemType("review-saved"),
                "A saved review covers this period, and nothing changes it.",
              );
            case "nothing_due":
              return problem(
                422,
                "No review is due",
                problemType("no-review-due"),
                "There is no closed, unreviewed period to open.",
              );
          }
        } catch {
          return unavailable();
        }
      },
    );
  },
);
