import { getConfig } from "@/config/env";
import { signOut } from "@/modules/session/service";
import { unauthenticated, unavailable } from "@/shared/http";
import { withRequestLog } from "@/shared/log";
import { sessionUserId } from "@/shared/session";

export const dynamic = "force-dynamic";

/**
 * DELETE /v1/session — sign out. The cookie is cleared; nothing is held on
 * the server to revoke (ADR-002).
 */
export async function DELETE(req: Request): Promise<Response> {
  return withRequestLog("DELETE /v1/session", {}, async () => {
    try {
      const userId = sessionUserId(
        req.headers.get("cookie"),
        new Date(),
        getConfig().sessionSecret,
      );
      if (!userId) return unauthenticated();
      return new Response(null, {
        status: 204,
        headers: { "set-cookie": signOut() },
      });
    } catch {
      return unavailable();
    }
  });
}
