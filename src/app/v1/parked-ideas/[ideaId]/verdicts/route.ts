import { createParkedIdeaVerdict } from "@/modules/parking/service";
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
 * POST /v1/parked-ideas/{ideaId}/verdicts — park, approve or drop. Appended,
 * never edited. Refused once the idea is dropped or taken (409), and when a
 * drop gives no reason or the verdict is dated in the future (422). A locked
 * idea is not refused: the verdict is recorded as early.
 */
export const POST = withSession(
  async (
    req: Request,
    ctx: { params: Promise<{ ideaId: string }> },
    userId: string,
  ): Promise<Response> => {
    const { ideaId } = await ctx.params;
    return withRequestLog(
      "POST /v1/parked-ideas/[ideaId]/verdicts",
      { idea_id: ideaId },
      async () => {
        if (!isUuid(ideaId)) return notFound("idea");
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
          const result = await createParkedIdeaVerdict(
            userId,
            ideaId,
            body,
            new Date(),
          );
          if (result.ok) return jsonResponse(201, result.idea);
          switch (result.kind) {
            case "invalid":
              return problem(
                400,
                "Invalid verdict",
                problemType("invalid"),
                "One or more fields failed validation.",
                result.errors,
              );
            case "not_found":
              return notFound("idea");
            case "final":
              return problem(
                409,
                "This idea's verdict is final",
                problemType("idea-final"),
                "It was dropped, or it became an objective, which is its record from then on.",
              );
            case "needs_reason":
              return problem(
                422,
                "A drop says why",
                problemType("drop-needs-reason"),
                "Send a note saying why the idea ended.",
              );
            case "future":
              return problem(
                422,
                "The verdict is dated in the future",
                problemType("verdict-in-future"),
                "A verdict is recorded once it has been given.",
              );
          }
        } catch {
          return unavailable();
        }
      },
    );
  },
);
