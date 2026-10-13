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
 * POST /v1/parked-ideas/{ideaId}/verdicts — park again or drop. Appended,
 * never edited. Refused once the idea is taken (409) and while it is still
 * locked (422): judging it in a hurry is what the lock exists to stop.
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
            case "taken":
              return problem(
                409,
                "This idea was taken",
                problemType("idea-taken"),
                "It became an objective, and the objective is its record from then on.",
              );
            case "locked":
              return problem(
                422,
                "This idea is still locked",
                problemType("idea-locked"),
                "A verdict before the lock lifts is what the parking lot exists to prevent.",
              );
          }
        } catch {
          return unavailable();
        }
      },
    );
  },
);
