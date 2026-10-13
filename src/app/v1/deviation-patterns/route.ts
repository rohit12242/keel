import {
  createDeviationPattern,
  listDeviationPatterns,
} from "@/modules/deviations/service";
import {
  jsonResponse,
  problem,
  problemType,
  unavailable,
  withSession,
} from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/** GET /v1/deviation-patterns — the caller's patterns, each with its computed count. */
export const GET = withSession(
  async (_req: Request, _ctx: unknown, userId: string): Promise<Response> =>
    withRequestLog("GET /v1/deviation-patterns", {}, async () => {
      try {
        return jsonResponse(200, {
          patterns: await listDeviationPatterns(userId),
        });
      } catch {
        return unavailable();
      }
    }),
);

/** POST /v1/deviation-patterns — name a pattern. A name already used is a 409. */
export const POST = withSession(
  async (req: Request, _ctx: unknown, userId: string): Promise<Response> =>
    withRequestLog("POST /v1/deviation-patterns", {}, async () => {
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
        const result = await createDeviationPattern(userId, body);
        if (result.ok) return jsonResponse(201, result.pattern);
        return result.kind === "invalid"
          ? problem(
              400,
              "Invalid pattern",
              problemType("invalid"),
              "One or more fields failed validation.",
              result.errors,
            )
          : problem(
              409,
              "That pattern already exists",
              problemType("pattern-exists"),
              "You already have a pattern with that name.",
            );
      } catch {
        return unavailable();
      }
    }),
);
