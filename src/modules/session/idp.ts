/**
 * The only file that talks to the identity provider (ADR-002). Two things:
 * where to send the browser to sign in, and exchanging the code it comes back
 * with for an identity token. Nothing after sign-in calls this — a session is
 * validated locally (NFR-08).
 */

/** How long the token exchange may take before sign-in reports 503. */
export const EXCHANGE_TIMEOUT_MS = 5000;

export type ProviderConfig = {
  domain: string;
  clientId: string;
  clientSecret: string;
};

/** The hosted login page, asking for a code with a PKCE S256 challenge. */
export function authorizeUrl(
  provider: ProviderConfig,
  redirectUri: string,
  state: string,
  challenge: string,
): string {
  const url = new URL("/oauth2/authorize", provider.domain);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    scope: "openid email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

export type Exchange =
  | { ok: true; claims: unknown }
  | { ok: false; kind: "refused" | "unavailable" };

/**
 * Exchange the code for tokens and return the identity token's claims. The
 * token arrives over TLS from the provider in answer to the client secret, so
 * its claims are read without a signature check (OIDC Core 3.1.3.7); the
 * caller checks what they say.
 *
 * A 4xx means the provider refused this code (expired, reused, forged). Any
 * other failure — a 5xx, a timeout, no connection — means it could not be
 * asked.
 */
export async function exchangeCode(
  provider: ProviderConfig,
  redirectUri: string,
  code: string,
  verifier: string,
): Promise<Exchange> {
  let res: Response;
  try {
    res = await fetch(new URL("/oauth2/token", provider.domain), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(
          `${provider.clientId}:${provider.clientSecret}`,
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: provider.clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, kind: "unavailable" };
  }

  if (res.status >= 400 && res.status < 500) {
    return { ok: false, kind: "refused" };
  }
  if (!res.ok) return { ok: false, kind: "unavailable" };

  try {
    const body = (await res.json()) as { id_token?: unknown };
    if (typeof body.id_token !== "string") {
      return { ok: false, kind: "refused" };
    }
    return { ok: true, claims: jwtPayload(body.id_token) };
  } catch {
    return { ok: false, kind: "unavailable" };
  }
}

/** The payload of a compact JWT, or null if it is not one. */
export function jwtPayload(token: string): unknown {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
