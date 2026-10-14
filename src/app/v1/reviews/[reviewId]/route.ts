import {
  discardReview,
  getReview,
  updateReview,
} from "@/modules/reviews/service";
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

const saved = () =>
  problem(
    409,
    "This review is saved",
    problemType("review-saved"),
    "A saved review is the record of what you concluded then, and nothing changes it.",
  );

/** PATCH /v1/reviews/{reviewId} — autosave the draft as typing pauses. */
export const PATCH = withSession(
  async (req: Request, ctx: Ctx, userId: string): Promise<Response> => {
    const { reviewId } = await ctx.params;
    return withRequestLog(
      "PATCH /v1/reviews/[reviewId]",
      { review_id: reviewId },
      async () => {
        if (!isUuid(reviewId)) return notFound("review");
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
          const result = await updateReview(userId, reviewId, body, new Date());
          if (result.ok) return jsonResponse(200, result.review);
          switch (result.kind) {
            case "invalid":
              return problem(
                400,
                "Invalid review",
                problemType("invalid"),
                "One or more fields failed validation.",
                result.errors,
              );
            case "plan_end_only":
              return problem(
                422,
                "Only a plan-end review carries that",
                problemType("plan-end-only"),
                `${result.fields.join(", ")}: plan-end reviews only.`,
              );
            case "not_found":
              return notFound("review");
            case "saved":
              return saved();
          }
        } catch {
          return unavailable();
        }
      },
    );
  },
);

/** DELETE /v1/reviews/{reviewId} — discard the draft. */
export const DELETE = withSession(
  async (_req: Request, ctx: Ctx, userId: string): Promise<Response> => {
    const { reviewId } = await ctx.params;
    return withRequestLog(
      "DELETE /v1/reviews/[reviewId]",
      { review_id: reviewId },
      async () => {
        if (!isUuid(reviewId)) return notFound("review");
        try {
          const result = await discardReview(userId, reviewId);
          if (result.ok) return new Response(null, { status: 204 });
          return result.kind === "not_found" ? notFound("review") : saved();
        } catch {
          return unavailable();
        }
      },
    );
  },
);
