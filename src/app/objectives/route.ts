import { createObjective, listObjectives } from "@/modules/objectives/service";
import {
  jsonResponse,
  malformedRecord,
  problem,
  problemType,
  unavailable,
} from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/**
 * GET /objectives — the caller's objectives, filtered by `status`
 * (docs/keel-api.yaml). One query, whatever the count (NFR-03's reason).
 * No auth yet (E-06).
 */
export async function GET(req: Request): Promise<Response> {
  const status = new URL(req.url).searchParams.get("status");

  return withRequestLog("GET /objectives", {}, async () => {
    try {
      const result = await listObjectives(status);
      if (result.ok) {
        return jsonResponse(200, { objectives: result.objectives });
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
}

/**
 * POST /objectives — declare an objective: the objective, segment 0 and its
 * created event in one transaction. `starts_on` comes from the body, never
 * from the server clock (NFR-12). 400 names each bad field; 422 is a schedule
 * that contradicts its mode.
 */
export async function POST(req: Request): Promise<Response> {
  return withRequestLog("POST /objectives", {}, async () => {
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
      const result = await createObjective(body);
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
      }
    } catch {
      return unavailable();
    }
  });
}
