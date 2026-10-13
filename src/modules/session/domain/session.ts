import { err, ok, type Result } from "@/shared/result";

/**
 * The session rules (ADR-002), pure: what a session holds, when it has
 * expired, what an identity token must say before Keel trusts it, and what a
 * sign-in does with the user it finds. No clock — `now` is always passed in,
 * in whole seconds since the epoch.
 */

/** How long a session lasts. ADR-002 asks for at least seven days. */
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

/** How long a started sign-in may take to come back from the provider. */
export const SIGN_IN_SECONDS = 10 * 60;

/** What `keel_session` carries: the user, and when the session ends. */
export type SessionPayload = { uid: string; exp: number };

/** What the sign-in cookie carries between leaving for the provider and coming back. */
export type SignInPayload = { state: string; verifier: string; exp: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isWholeSeconds = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

export const newSession = (uid: string, now: number): SessionPayload => ({
  uid,
  exp: now + SESSION_SECONDS,
});

export const newSignIn = (
  state: string,
  verifier: string,
  now: number,
): SignInPayload => ({ state, verifier, exp: now + SIGN_IN_SECONDS });

/**
 * A session payload, if `value` is one that is still live at `now`. The
 * signature has already been checked; this checks the shape and the expiry,
 * so a cookie signed by Keel but malformed is still refused.
 */
export function liveSession(
  value: unknown,
  now: number,
): SessionPayload | null {
  if (!isRecord(value)) return null;
  const { uid, exp } = value;
  if (typeof uid !== "string" || !UUID.test(uid)) return null;
  if (!isWholeSeconds(exp) || exp <= now) return null;
  return { uid, exp };
}

/** The same, for the sign-in cookie. */
export function liveSignIn(value: unknown, now: number): SignInPayload | null {
  if (!isRecord(value)) return null;
  const { state, verifier, exp } = value;
  if (typeof state !== "string" || state.length === 0) return null;
  if (typeof verifier !== "string" || verifier.length === 0) return null;
  if (!isWholeSeconds(exp) || exp <= now) return null;
  return { state, verifier, exp };
}

/** The token issuer for a pool: its region is the pool id's prefix. */
export const issuerFor = (poolId: string): string =>
  `https://cognito-idp.${poolId.split("_")[0]}.amazonaws.com/${poolId}`;

/** Who signed in, once the identity token has been checked. */
export type Identity = { subject: string; email: string };

export type ClaimsRefusal =
  | "malformed"
  | "wrong_issuer"
  | "wrong_audience"
  | "not_an_id_token"
  | "expired"
  | "email_not_verified";

/**
 * Check the identity token's claims. The token comes straight from the
 * provider's token endpoint over TLS, in exchange for a code and the client
 * secret, so its origin is already established (OIDC Core 3.1.3.7); what is
 * left is to confirm it was issued by this pool, to this client, as an id
 * token, is not expired, and names a verified email.
 */
export function checkIdClaims(
  claims: unknown,
  expected: { issuer: string; clientId: string },
  now: number,
): Result<Identity, ClaimsRefusal> {
  if (!isRecord(claims)) return err("malformed");
  const { iss, aud, token_use, exp, sub, email, email_verified } = claims;
  if (iss !== expected.issuer) return err("wrong_issuer");
  if (aud !== expected.clientId) return err("wrong_audience");
  if (token_use !== "id") return err("not_an_id_token");
  if (!isWholeSeconds(exp) || exp <= now) return err("expired");
  if (typeof sub !== "string" || sub.length === 0) return err("malformed");
  if (typeof email !== "string" || !email.includes("@")) {
    return err("malformed");
  }
  // Cognito sends a boolean; some providers send the string. Only true counts.
  if (email_verified !== true && email_verified !== "true") {
    return err("email_not_verified");
  }
  return ok({ subject: sub, email });
}

export type SignInDecision =
  { kind: "use"; userId: string } | { kind: "create"; identity: Identity };

/**
 * A sign-in finds its user by subject, or creates one. There is no matching
 * by email (ERD, *User*): a different subject is a different person to Keel,
 * even with the same address.
 */
export function signInDecision(
  identity: Identity,
  bySubject: { id: string } | null,
): SignInDecision {
  return bySubject
    ? { kind: "use", userId: bySubject.id }
    : { kind: "create", identity };
}
