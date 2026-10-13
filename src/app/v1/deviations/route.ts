import { createDeviation, listDeviations } from "@/modules/deviations/service";
import {
  jsonResponse,
  problem,
  problemType,
  unavailable,
  withSession,
} from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/**
 * GET /v1/deviations?from=&to=[&objective_id=] — the Deviations screen:
 * newest first, each with the objectives it names, and the cost by kind.
 */
export const GET = withSession(
  async (req: Request, _ctx: unknown, userId: string): Promise<Response> => {
    const params = new URL(req.url).searchParams;
    return withRequestLog("GET /v1/deviations", {}, async () => {
      try {
        const result = await listDeviations(
          userId,
          params.get("from"),
          params.get("to"),
          params.get("objective_id"),
        );
        if (result.ok) {
          return jsonResponse(200, {
            deviations: result.deviations,
            cost: result.cost,
          });
        }
        return problem(
          400,
          "Invalid range",
          problemType("invalid"),
          "One or more parameters failed validation.",
          result.errors,
        );
      } catch {
        return unavailable();
      }
    });
  },
);

/**
 * POST /v1/deviations — record a deviation against the objectives it pulled
 * you off. Logged by type only: the reasoning is the user's text (NFR-11).
 */
export const POST = withSession(
  async (req: Request, _ctx: unknown, userId: string): Promise<Response> =>
    withRequestLog("POST /v1/deviations", {}, async () => {
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
        const result = await createDeviation(userId, body, new Date());
        if (result.ok) return jsonResponse(201, result.deviation);
        return result.kind === "invalid"
          ? problem(
              400,
              "Invalid deviation",
              problemType("invalid"),
              "One or more fields failed validation.",
              result.errors,
            )
          : problem(
              422,
              "This deviation can't be recorded",
              problemType("deviation-refused"),
              result.detail,
            );
      } catch {
        return unavailable();
      }
    }),
);
