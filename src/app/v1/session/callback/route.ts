import { completeSignIn } from "@/modules/session/service";
import { problem, problemType, unavailable } from "@/shared/http";
import { logLine, withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/**
 * GET /v1/session/callback — where the provider sends the browser back. The
 * one request that reaches the provider (ADR-002): the code is exchanged, the
 * user found by subject or created, and Keel's own session begins. Refusal
 * reasons are logged as types, never the token or the email (NFR-11).
 */
export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;

  return withRequestLog("GET /v1/session/callback", {}, async () => {
    let result;
    try {
      result = await completeSignIn(
        params.get("code"),
        params.get("state"),
        req.headers.get("cookie"),
        new Date(),
      );
    } catch {
      return unavailable();
    }

    if (result.ok) {
      const headers = new Headers({ location: "/" });
      for (const c of result.cookies) headers.append("set-cookie", c);
      return new Response(null, { status: 302, headers });
    }

    switch (result.kind) {
      case "bad_state":
        return problem(
          400,
          "This sign-in can't be finished",
          problemType("sign-in-state"),
          "It was not started in this browser, or it took too long. Sign in again.",
        );
      case "refused":
        logLine("sign_in_refused", { reason: result.reason });
        return problem(
          401,
          "The sign-in was refused",
          problemType("sign-in-refused"),
          "The provider did not confirm who signed in. Sign in again.",
        );
      case "email_taken":
        return problem(
          409,
          "This email already belongs to another account",
          problemType("email-taken"),
          "A Keel record already uses this email under a different sign-in. Nothing was created.",
        );
      case "unavailable":
        return problem(
          503,
          "Couldn't reach the sign-in service",
          problemType("unavailable"),
          "The identity provider could not be reached. Try again shortly.",
        );
    }
  });
}
