import { signOut } from "@/modules/session/service";
import { withSession } from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/**
 * DELETE /v1/session — sign out. The cookie is cleared; nothing is held on
 * the server to revoke (ADR-002).
 */
export const DELETE = withSession(async (): Promise<Response> =>
  withRequestLog("DELETE /v1/session", {}, async () => {
    return new Response(null, {
      status: 204,
      headers: { "set-cookie": signOut() },
    });
  }),
);
