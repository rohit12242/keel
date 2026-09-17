import { pingDatabase } from "@/modules/health/repo";
import { jsonResponse } from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/**
 * GET /health — a liveness check that also reports database reachability
 * (W3-16, adjusted for W3-17 / ADR-006).
 *
 * Returns HTTP 200 whenever the app process is serving (so a load balancer
 * routes to a live task even before a database exists — STEP 1 has none). The
 * two answers stay distinguishable in the body: `app` is "ok" whenever this
 * responds at all (an app crash yields no body), and `database` is the result
 * of a real round trip (SELECT 1) — "ok" or "unreachable", with `status`
 * "ok"/"degraded" summarising. Callers that require the DB (the deploy smoke
 * check) assert on `database`, not just the HTTP status.
 */
export async function GET(): Promise<Response> {
  return withRequestLog("GET /health", {}, async () => {
    const dbOk = await pingDatabase();
    return jsonResponse(200, {
      status: dbOk ? "ok" : "degraded",
      app: "ok",
      database: dbOk ? "ok" : "unreachable",
      checked_at: new Date().toISOString(),
    });
  });
}
