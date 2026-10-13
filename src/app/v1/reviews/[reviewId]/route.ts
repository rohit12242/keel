import { getReview } from "@/modules/reviews/service";
import {
  isUuid,
  jsonResponse,
  notFound,
  unavailable,
  withSession,
} from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ reviewId: string }> };

/** GET /v1/reviews/{reviewId} — one review, every figure recomputed now. */
export const GET = withSession(
  async (_req: Request, ctx: Ctx, userId: string): Promise<Response> => {
    const { reviewId } = await ctx.params;
    return withRequestLog(
      "GET /v1/reviews/[reviewId]",
      { review_id: reviewId },
      async () => {
        if (!isUuid(reviewId)) return notFound("review");
        try {
          const review = await getReview(userId, reviewId, new Date());
          return review ? jsonResponse(200, review) : notFound("review");
        } catch {
          return unavailable();
        }
      },
    );
  },
);
