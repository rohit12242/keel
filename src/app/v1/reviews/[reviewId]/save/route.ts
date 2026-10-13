import { saveReview } from "@/modules/reviews/service";
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

/** POST /v1/reviews/{reviewId}/save — the draft becomes the record. */
export const POST = withSession(
  async (
    _req: Request,
    ctx: { params: Promise<{ reviewId: string }> },
    userId: string,
  ): Promise<Response> => {
    const { reviewId } = await ctx.params;
    return withRequestLog(
      "POST /v1/reviews/[reviewId]/save",
      { review_id: reviewId },
      async () => {
        if (!isUuid(reviewId)) return notFound("review");
        try {
          const result = await saveReview(userId, reviewId, new Date());
          if (result.ok) return jsonResponse(200, result.review);
          switch (result.kind) {
            case "not_found":
              return notFound("review");
            case "already_saved":
              return problem(
                409,
                "Already saved",
                problemType("review-saved"),
                "This review is already the record.",
              );
            case "refused":
              return problem(
                422,
                "This review can't be saved yet",
                problemType("review-incomplete"),
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
