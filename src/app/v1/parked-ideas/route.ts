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

/**
 * GET /v1/parked-ideas — the parking lot, with each idea's verdict and lock.
 * `?caught_on=` adds the lock an idea parked that day would get.
 */
export const GET = withSession(
  async (req: Request, _ctx: unknown, userId: string): Promise<Response> =>
    withRequestLog("GET /v1/parked-ideas", {}, async () => {
      try {
        const caughtOn = new URL(req.url).searchParams.get("caught_on");
        const result = await listParkedIdeas(userId, new Date(), caughtOn);
        if (!result.ok) {
          return problem(
            400,
            "Invalid query",
            problemType("invalid"),
            "caught_on must be a date.",
            result.errors,
          );
        }
        return jsonResponse(
          200,
          result.new_idea_locked_until === undefined
            ? { ideas: result.ideas }
            : {
                ideas: result.ideas,
                new_idea_locked_until: result.new_idea_locked_until,
              },
        );
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
