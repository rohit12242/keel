import { pingDatabase } from "@/modules/health/repo";
import { jsonResponse } from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/**
 * GET /health — two distinct answers (W3-16):
 *   - the app is alive: if this responds at all, the process is up. An app
 *     crash shows as no response / a connection error, never a JSON body.
 *   - the database is reachable: a real round trip (SELECT 1).
 *
 * `app` and `database` are reported separately, and the HTTP status differs:
 * 200 when the database answers, 503 when only the app is up. That is how a
 * database outage is told apart from an app crash.
 */
export async function GET(): Promise<Response> {
  return withRequestLog("GET /health", {}, async () => {
    const dbOk = await pingDatabase();
    return jsonResponse(dbOk ? 200 : 503, {
      status: dbOk ? "ok" : "degraded",
      app: "ok",
      database: dbOk ? "ok" : "unreachable",
      checked_at: new Date().toISOString(),
    });
  });
}
