import { createEffortEntry } from "@/modules/effort/service";
import { jsonResponse, problem, problemType } from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /objectives/{objectiveId}/effort-entries — log effort
 * (docs/keel-api.yaml). local_date and tz come from the body, never from the
 * server clock (NFR-12). No auth yet (E-06). A row belonging to another user is
 * a 404, not a 403 (NFR-10).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ objectiveId: string }> },
): Promise<Response> {
  const { objectiveId } = await ctx.params;

  return withRequestLog(
    "POST /objectives/[objectiveId]/effort-entries",
    { objective_id: objectiveId },
    async () => {
      if (!UUID.test(objectiveId)) {
        return problem(
          404,
          "Not found",
          problemType("not-found"),
          "No such objective.",
        );
      }

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
        const result = await createEffortEntry(objectiveId, body);
        if (result.ok) return jsonResponse(201, result.entry);

        switch (result.kind) {
          case "validation":
            return problem(
              400,
              "Invalid effort entry",
              problemType("invalid"),
              "One or more fields failed validation.",
              result.errors,
            );
          case "not_found":
            return problem(
              404,
              "Not found",
              problemType("not-found"),
              "No such objective.",
            );
          case "not_active":
            return problem(
              422,
              "This objective is not active",
              problemType("objective-not-active"),
              "Ended or completed objectives accept no new effort.",
            );
          case "outside_plan":
            return problem(
              422,
              "Outside the plan",
              problemType("date-outside-plan"),
              "local_date falls outside every plan segment for this objective.",
            );
        }
      } catch {
        return problem(
          503,
          "Couldn't reach your log",
          problemType("unavailable"),
          "The database could not be reached.",
        );
      }
    },
  );
}
