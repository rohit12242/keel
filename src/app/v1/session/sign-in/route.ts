import { startSignIn } from "@/modules/session/service";
import { unavailable } from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/**
 * GET /v1/session/sign-in — off to the provider's login page, with a
 * short-lived cookie holding `state` and the PKCE verifier (ADR-002). The
 * provider is not contacted here.
 */
export async function GET(): Promise<Response> {
  return withRequestLog("GET /v1/session/sign-in", {}, async () => {
    try {
      const { location, cookie } = startSignIn(new Date());
      return new Response(null, {
        status: 302,
        headers: { location, "set-cookie": cookie },
      });
    } catch {
      return unavailable();
    }
  });
}
