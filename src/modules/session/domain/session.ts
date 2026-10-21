import { err, ok, type Result } from "@/shared/result";

/**
 * The session rules (ADR-002), pure: what a session holds, when it has
 * expired, what an identity token must say before Keel trusts it, and what a
 * sign-in does with the user it finds. No clock — `now` is always passed in,
 * in whole seconds since the epoch.
 */

/** How long a session lasts. ADR-002 asks for at least seven days. */
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

/**
 * How old a sign-in may be when it is exchanged for a session (ADR-002). An
 * ID token is valid for longer; this is what stops a leaked one becoming a
 * session.
 */
export const FRESH_SIGN_IN_SECONDS = 5 * 60;

/** Who a session belongs to, copied from the ID token at the exchange. */
export type SignedIn = { id: string; email: string; name: string | null };

/**
 * What `keel_session` carries: the user, their email and name, and when the
 * session ends. A page knows who is signed in without a database read.
 */
export type SessionPayload = {
  uid: string;
  email: string;
  name: string | null;
  exp: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isWholeSeconds = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

export const newSession = (user: SignedIn, now: number): SessionPayload => ({
  uid: user.id,
  email: user.email,
  name: user.name,
  exp: now + SESSION_SECONDS,
});

/**
 * A session payload, if `value` is one that is still live at `now`. The
 * signature has already been checked; this checks the shape and the expiry,
 * so a cookie signed by Keel but malformed is still refused — including one
 * from before I-04, which carried no email or name.
 */
export function liveSession(
  value: unknown,
  now: number,
): SessionPayload | null {
  if (!isRecord(value)) return null;
  const { uid, email, name, exp } = value;
  if (typeof uid !== "string" || !UUID.test(uid)) return null;
  if (typeof email !== "string" || !email.includes("@")) return null;
  if (name !== null && typeof name !== "string") return null;
  if (!isWholeSeconds(exp) || exp <= now) return null;
  return { uid, email, name, exp };
}

/** The name to show: Cognito's, or the part of the email before the `@`. */
export function displayName(name: string | null, email: string): string {
  const given = name?.trim();
  return given ? given : email.slice(0, email.indexOf("@"));
}

/** The token issuer for a pool: its region is the pool id's prefix. */
export const issuerFor = (poolId: string): string =>
  `https://cognito-idp.${poolId.split("_")[0]}.amazonaws.com/${poolId}`;

/** Who signed in, once the identity token has been checked. */
export type Identity = { subject: string; email: string; name: string | null };

export type ClaimsRefusal =
  | "malformed"
  | "wrong_issuer"
  | "wrong_audience"
  | "not_an_id_token"
  | "expired"
  | "stale_sign_in"
  | "email_not_verified";

/**
 * Check the identity token's claims. Its signature has already been checked
 * against the pool's published keys (`cognito.ts`); what is left is to
 * confirm it was issued by this pool, to this client, as an id token, is not expired, comes from a sign-in no older than five minutes, and
 * names a verified email. The name is optional: an account may have none.
 */
export function checkIdClaims(
  claims: unknown,
  expected: { issuer: string; clientId: string },
  now: number,
): Result<Identity, ClaimsRefusal> {
  if (!isRecord(claims)) return err("malformed");
  const { iss, aud, token_use, exp, auth_time, sub, email, email_verified } =
    claims;
  if (iss !== expected.issuer) return err("wrong_issuer");
  if (aud !== expected.clientId) return err("wrong_audience");
  if (token_use !== "id") return err("not_an_id_token");
  if (!isWholeSeconds(exp) || exp <= now) return err("expired");
  if (!isWholeSeconds(auth_time)) return err("malformed");
  if (now - auth_time > FRESH_SIGN_IN_SECONDS) return err("stale_sign_in");
  if (typeof sub !== "string" || sub.length === 0) return err("malformed");
  if (typeof email !== "string" || !email.includes("@")) {
    return err("malformed");
  }
  // Cognito sends a boolean; some providers send the string. Only true counts.
  if (email_verified !== true && email_verified !== "true") {
    return err("email_not_verified");
  }
  const name = typeof claims.name === "string" ? claims.name : null;
  return ok({ subject: sub, email, name });
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
