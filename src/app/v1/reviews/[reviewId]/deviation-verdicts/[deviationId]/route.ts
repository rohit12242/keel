import { setVerdict } from "@/modules/reviews/service";
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
 * PUT /v1/reviews/{reviewId}/deviation-verdicts/{deviationId} — judge a
 * chosen deviation: worth it, or not. Idempotent.
 */
export const PUT = withSession(
  async (
    req: Request,
    ctx: { params: Promise<{ reviewId: string; deviationId: string }> },
    userId: string,
  ): Promise<Response> => {
    const { reviewId, deviationId } = await ctx.params;
    return withRequestLog(
      "PUT /v1/reviews/[reviewId]/deviation-verdicts/[deviationId]",
      { review_id: reviewId, deviation_id: deviationId },
      async () => {
        if (!isUuid(reviewId)) return notFound("review");
        if (!isUuid(deviationId)) return notFound("deviation");
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          body = null;
        }
        try {
          const result = await setVerdict(userId, reviewId, deviationId, body);
          if (result.ok) return jsonResponse(200, result.deviation);
          switch (result.kind) {
            case "invalid":
              return problem(
                400,
                "Invalid verdict",
                problemType("invalid"),
                "One or more fields failed validation.",
                [{ field: "verdict", message: "worth_it or not_worth_it." }],
              );
            case "not_found":
              return notFound(result.what);
            case "not_judgeable":
              return problem(
                422,
                "This review can't judge that deviation",
                problemType("deviation-not-judgeable"),
                result.detail,
              );
            case "conflict":
              return problem(
                409,
                "The verdict stands",
                problemType("verdict-stands"),
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
