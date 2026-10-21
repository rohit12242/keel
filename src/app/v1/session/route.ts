import {
  createSession,
  signOut,
  signedInUser,
} from "@/modules/session/service";
import {
  jsonResponse,
  problem,
  problemType,
  unauthenticated,
  unavailable,
  withSession,
} from "@/shared/http";
import { logLine, withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

/**
 * GET /v1/session — who is signed in, read from the cookie alone: no
 * database read and no call to Cognito (ADR-002).
 */
export async function GET(req: Request): Promise<Response> {
  return withRequestLog("GET /v1/session", {}, async () => {
    const user = signedInUser(req.headers.get("cookie"), new Date());
    return user ? jsonResponse(200, user) : unauthenticated();
  });
}

/**
 * POST /v1/session — turn a sign-in that has just happened at Cognito into
 * Keel's session. The body holds the ID token; it is never logged, and a
 * refusal is logged by its reason's type alone (NFR-11).
 */
export async function POST(req: Request): Promise<Response> {
  return withRequestLog("POST /v1/session", {}, async () => {
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      // Not JSON: refused as invalid, after the origin is checked.
    }

    let result;
    try {
      result = await createSession(req.headers.get("origin"), body, new Date());
    } catch {
      return unavailable();
    }

    if (result.ok) {
      return new Response(null, {
        status: 204,
        headers: { "set-cookie": result.cookie },
      });
    }

    switch (result.kind) {
      case "wrong_origin":
        return problem(
          403,
          "A session can only be started from Keel",
          problemType("wrong-origin"),
          "Sign in on Keel's own sign-in screen.",
        );
      case "invalid":
        return problem(
          400,
          "Invalid request",
          problemType("invalid"),
          "The body must be JSON naming the ID token.",
          [{ field: "id_token", message: "Required." }],
        );
      case "refused":
        logLine("sign_in_refused", { reason: result.reason });
        return problem(
          401,
          "The sign-in was refused",
          problemType("sign-in-refused"),
          "Keel could not confirm who signed in. Sign in again.",
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
          "Cognito's signing keys could not be fetched. Try again shortly.",
        );
    }
  });
}

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
