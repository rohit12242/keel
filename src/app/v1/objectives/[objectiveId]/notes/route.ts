import { createObjectiveNote } from "@/modules/objectives/service";
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
 * POST /v1/objectives/{objectiveId}/notes — add a note. Append-only and open
 * in every state; a note dated after today is a 422. The text is never
 * logged (NFR-11).
 */
export const POST = withSession(
  async (
    req: Request,
    ctx: { params: Promise<{ objectiveId: string }> },
    userId: string,
  ): Promise<Response> => {
    const { objectiveId } = await ctx.params;
    return withRequestLog(
      "POST /v1/objectives/[objectiveId]/notes",
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
          const result = await createObjectiveNote(
            userId,
            objectiveId,
            body,
            new Date(),
          );
          if (result.ok) return jsonResponse(201, result.note);
          switch (result.kind) {
            case "invalid":
              return problem(
                400,
                "Invalid note",
                problemType("invalid"),
                "One or more fields failed validation.",
                result.errors,
              );
            case "not_found":
              return notFound("objective");
            case "future":
              return problem(
                422,
                "The note is dated in the future",
                problemType("note-in-future"),
                "A note is written on or before today.",
              );
          }
        } catch {
          return unavailable();
        }
      },
    );
  },
);
