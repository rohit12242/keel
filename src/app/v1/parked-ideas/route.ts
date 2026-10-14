import { createParkedIdea, listParkedIdeas } from "@/modules/parking/service";
import {
  jsonResponse,
  problem,
  problemType,
  unavailable,
  withSession,
} from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/** GET /v1/parked-ideas — the parking lot, with each idea's verdict and lock. */
export const GET = withSession(
  async (_req: Request, _ctx: unknown, userId: string): Promise<Response> =>
    withRequestLog("GET /v1/parked-ideas", {}, async () => {
      try {
        return jsonResponse(200, {
          ideas: await listParkedIdeas(userId, new Date()),
        });
      } catch {
        return unavailable();
      }
    }),
);

/** POST /v1/parked-ideas — park an idea; the server sets its lock. */
export const POST = withSession(
  async (req: Request, _ctx: unknown, userId: string): Promise<Response> =>
    withRequestLog("POST /v1/parked-ideas", {}, async () => {
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
        const result = await createParkedIdea(userId, body, new Date());
        if (result.ok) return jsonResponse(201, result.idea);
        return problem(
          400,
          "Invalid idea",
          problemType("invalid"),
          "One or more fields failed validation.",
          result.errors,
        );
      } catch {
        return unavailable();
      }
    }),
);
