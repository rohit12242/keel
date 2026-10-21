import { createPublicKey, verify, type JsonWebKey } from "node:crypto";

/**
 * The only file that talks to Cognito (ADR-002): fetching the pool's
 * published signing keys, and checking an ID token's signature against them.
 * It is reached only by the exchange, `POST /v1/session` — an open session is
 * validated from its cookie with no network call (NFR-08).
 */

/** How long fetching the keys may take before the exchange reports 503. */
export const KEYS_TIMEOUT_MS = 5000;

/** One of the pool's published keys: an RSA public key named by `kid`. */
export type SigningKey = JsonWebKey & { kid: string };

export type Keys =
  { ok: true; keys: SigningKey[] } | { ok: false; kind: "unavailable" };

/**
 * The pool's keys, from its JWKS endpoint. Any failure — a 4xx or 5xx, a
 * timeout, no connection, a body that is not a key set — means the keys could
 * not be had, and the exchange answers 503.
 */
export async function fetchSigningKeys(issuer: string): Promise<Keys> {
  try {
    const res = await fetch(`${issuer}/.well-known/jwks.json`, {
      signal: AbortSignal.timeout(KEYS_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, kind: "unavailable" };
    const body = (await res.json()) as { keys?: unknown };
    if (!Array.isArray(body.keys)) return { ok: false, kind: "unavailable" };
    const keys = body.keys.filter(
      (k): k is SigningKey =>
        typeof k === "object" && k !== null && typeof k.kid === "string",
    );
    return { ok: true, keys };
  } catch {
    return { ok: false, kind: "unavailable" };
  }
}

export type SignatureRefusal = "malformed" | "unknown_key" | "bad_signature";

export type Signed =
  { ok: true; claims: unknown } | { ok: false; reason: SignatureRefusal };

const decode = (part: string): unknown => {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

/**
 * The token's claims, if it is a compact JWT signed RS256 by one of `keys`.
 * Only RS256 is accepted — never `none`, never an HMAC that a public key
 * could be mistaken for the secret of. The claims themselves are checked by
 * the caller (`checkIdClaims`).
 */
export function verifySignature(token: string, keys: SigningKey[]): Signed {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = decode(headerPart) as { alg?: unknown; kid?: unknown } | null;
  if (!header || typeof header !== "object") {
    return { ok: false, reason: "malformed" };
  }
  if (header.alg !== "RS256") return { ok: false, reason: "bad_signature" };

  const jwk = keys.find((k) => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) return { ok: false, reason: "unknown_key" };

  let valid: boolean;
  try {
    valid = verify(
      "RSA-SHA256",
      Buffer.from(`${headerPart}.${payloadPart}`),
      createPublicKey({ key: jwk, format: "jwk" }),
      Buffer.from(signaturePart, "base64url"),
    );
  } catch {
    return { ok: false, reason: "bad_signature" };
  }
  if (!valid) return { ok: false, reason: "bad_signature" };

  const claims = decode(payloadPart);
  return claims === null
    ? { ok: false, reason: "malformed" }
    : { ok: true, claims };
}
