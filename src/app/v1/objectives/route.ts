import { createObjective, listObjectives } from "@/modules/objectives/service";
import {
  jsonResponse,
  malformedRecord,
  problem,
  problemType,
  unavailable,
  withSession,
} from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/**
 * GET /v1/objectives — the caller's objectives, filtered by `status`
 * (docs/keel-api.yaml). One query, whatever the count (NFR-03's reason).
 */
export const GET = withSession(
  async (req: Request, _ctx: unknown, userId: string): Promise<Response> => {
    const status = new URL(req.url).searchParams.get("status");

    return withRequestLog("GET /v1/objectives", {}, async () => {
      try {
        const result = await listObjectives(userId, status, new Date());
        if (result.ok) {
          return jsonResponse(200, {
            objectives: result.objectives,
            committed_minutes_per_week: result.committed_minutes_per_week,
          });
        }
        switch (result.kind) {
          case "invalid":
            return problem(
              400,
              "Invalid status filter",
              problemType("invalid"),
              "One or more parameters failed validation.",
              result.errors,
            );
          case "malformed":
            return malformedRecord();
        }
      } catch {
        return unavailable();
      }
    });
  },
);

/**
 * POST /v1/objectives — declare an objective: the objective, segment 0 and its
 * created event in one transaction. `starts_on` comes from the body, never
 * from the server clock (NFR-12). 400 names each bad field; 422 is a schedule
 * that contradicts its mode.
 */
export const POST = withSession(
  async (req: Request, _ctx: unknown, userId: string): Promise<Response> => {
    return withRequestLog("POST /v1/objectives", {}, async () => {
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
        const result = await createObjective(userId, body, new Date());
        if (result.ok) return jsonResponse(201, result.objective);
        switch (result.kind) {
          case "invalid":
            return problem(
              400,
              "Invalid objective",
              problemType("invalid"),
              "One or more fields failed validation.",
              result.errors,
            );
          case "mode_mismatch":
            return problem(
              422,
              "The schedule contradicts its mode",
              problemType("schedule-mode-mismatch"),
              result.detail,
            );
          case "idea_unavailable":
            return problem(
              422,
              "That idea can't be taken",
              problemType("idea-unavailable"),
              result.detail,
            );
        }
      } catch {
        return unavailable();
      }
    });
  },
);
