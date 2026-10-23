import { getConfig } from "@/config/env";
import type { SessionUser } from "@/shared/contract";
import {
  clearSessionCookie,
  nowSeconds,
  sessionCookie,
  sessionOf,
} from "@/shared/session";
import {
  checkIdClaims,
  displayName,
  exchangeBody,
  issuerFor,
  signInDecision,
} from "./domain/session";
import { fetchSigningKeys, verifySignature } from "./cognito";
import { createUser, findUserBySubject, setZone } from "./repo";
import type { ProblemError } from "@/shared/contract";

/**
 * session/service — turning a sign-in into a session, reading it, ending it
 * (ADR-002). The browser proves the password to Cognito itself; Keel only
 * ever sees the ID token, and reaches Cognito only for its signing keys.
 */

export type CreateSession =
  | { ok: true; cookie: string }
  | { ok: false; kind: "wrong_origin" }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "refused"; reason: string }
  | { ok: false; kind: "unavailable" }
  | { ok: false; kind: "email_taken" };

/**
 * Exchange a fresh Cognito ID token for Keel's session. In this order, so
 * each refusal costs as little as possible: the request must come from
 * Keel's own origin (before anything is read or fetched), the body must name
 * a token and a known zone, the token must be signed by the pool and say what
 * Keel accepts — including a sign-in no older than five minutes — and then
 * the user is found by subject or created. Either way, the zone sent becomes
 * the user's (I-07).
 */
export async function createSession(
  origin: string | null,
  body: unknown,
  now: Date,
): Promise<CreateSession> {
  const { appBaseUrl, sessionSecret, cognito } = getConfig();
  if (origin !== new URL(appBaseUrl).origin) {
    return { ok: false, kind: "wrong_origin" };
  }

  const sent = exchangeBody(body);
  if (!sent.ok) return { ok: false, kind: "invalid", errors: sent.error };
  const { idToken, tz } = sent.value;

  const issuer = issuerFor(cognito.poolId);
  const keys = await fetchSigningKeys(issuer);
  if (!keys.ok) return { ok: false, kind: "unavailable" };

  const signed = verifySignature(idToken, keys.keys);
  if (!signed.ok) return { ok: false, kind: "refused", reason: signed.reason };

  const identity = checkIdClaims(
    signed.claims,
    { issuer, clientId: cognito.clientId },
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
    await setZone(userId, tz);
  } else {
    const created = await createUser(decision.identity, tz);
    if (!created.ok) return { ok: false, kind: "email_taken" };
    userId = created.id;
  }

  const { email, name } = identity.value;
  return {
    ok: true,
    cookie: sessionCookie({ id: userId, email, name }, now, sessionSecret),
  };
}

/** Who is signed in, from the cookie alone: no database, no Cognito. */
export function signedInUser(
  cookieHeader: string | null,
  now: Date,
): SessionUser | null {
  const user = sessionOf(cookieHeader, now, getConfig().sessionSecret);
  return user
    ? {
        id: user.id,
        email: user.email,
        name: displayName(user.name, user.email),
      }
    : null;
}

/** Signing out clears the cookie; nothing is held server-side to revoke. */
export const signOut = (): string => clearSessionCookie();
