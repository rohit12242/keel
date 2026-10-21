import { createHash, randomBytes } from "node:crypto";
import { getConfig } from "@/config/env";
import {
  clearSessionCookie,
  clearSignInCookie,
  nowSeconds,
  readSignIn,
  sessionCookie,
  signInCookie,
} from "@/shared/session";
import { checkIdClaims, issuerFor, signInDecision } from "./domain/session";
import { authorizeUrl, exchangeCode } from "./idp";
import { createUser, findUserBySubject } from "./repo";

/**
 * session/service — signing in and out (ADR-002). The provider is contacted
 * once, at the callback; everything after reads Keel's own cookie.
 */

const randomToken = (): string => randomBytes(32).toString("base64url");

const challengeFor = (verifier: string): string =>
  createHash("sha256").update(verifier).digest("base64url");

function provider() {
  const { cognito, appBaseUrl } = getConfig();
  return {
    provider: {
      domain: cognito.domain,
      clientId: cognito.clientId,
      clientSecret: cognito.clientSecret,
    },
    redirectUri: `${appBaseUrl}/v1/session/callback`,
  };
}

/** Where to send the browser, and the cookie that remembers this attempt. */
export function startSignIn(now: Date): { location: string; cookie: string } {
  const { provider: p, redirectUri } = provider();
  const state = randomToken();
  const verifier = randomToken();
  return {
    location: authorizeUrl(p, redirectUri, state, challengeFor(verifier)),
    cookie: signInCookie(state, verifier, now, getConfig().sessionSecret),
  };
}

export type CompleteSignIn =
  | { ok: true; cookies: string[] }
  | { ok: false; kind: "bad_state" }
  | { ok: false; kind: "refused"; reason: string }
  | { ok: false; kind: "unavailable" }
  | { ok: false; kind: "email_taken" };

/**
 * Finish a sign-in: the browser must bring back the `state` it left with,
 * the provider must accept the code, and the identity must check out. Then
 * the user is found by subject or created, and a session starts.
 */
export async function completeSignIn(
  code: string | null,
  state: string | null,
  cookieHeader: string | null,
  now: Date,
): Promise<CompleteSignIn> {
  const { sessionSecret, cognito } = getConfig();
  const started = readSignIn(cookieHeader, now, sessionSecret);
  if (!code || !state || !started || started.state !== state) {
    return { ok: false, kind: "bad_state" };
  }

  const { provider: p, redirectUri } = provider();
  const exchange = await exchangeCode(p, redirectUri, code, started.verifier);
  if (!exchange.ok) {
    return exchange.kind === "refused"
      ? { ok: false, kind: "refused", reason: "code_refused" }
      : { ok: false, kind: "unavailable" };
  }

  const identity = checkIdClaims(
    exchange.claims,
    { issuer: issuerFor(cognito.poolId), clientId: cognito.clientId },
    nowSeconds(now),
  );
  if (!identity.ok) {
    return { ok: false, kind: "refused", reason: identity.error };
  }

  const decision = signInDecision(
    identity.value,
    await findUserBySubject(identity.value.subject),
  );
  let userId: string;
  if (decision.kind === "use") {
    userId = decision.userId;
  } else {
    const created = await createUser(decision.identity);
    if (!created.ok) return { ok: false, kind: "email_taken" };
    userId = created.id;
  }

  return {
    ok: true,
    cookies: [
      sessionCookie(
        { id: userId, email: identity.value.email, name: identity.value.name },
        now,
        sessionSecret,
      ),
      clearSignInCookie(),
    ],
  };
}

/** Signing out clears the cookie; nothing is held server-side to revoke. */
export const signOut = (): string => clearSessionCookie();
