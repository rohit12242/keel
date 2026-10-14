import { createHmac, timingSafeEqual } from "node:crypto";
import {
  liveSession,
  liveSignIn,
  newSession,
  newSignIn,
  SESSION_SECONDS,
  SIGN_IN_SECONDS,
} from "@/modules/session/domain/session";

/**
 * Keel's own cookies (ADR-002): `keel_session`, and the short-lived cookie
 * that carries `state` and the PKCE verifier through a sign-in. Both are
 * HMAC-SHA256 signed with SESSION_SECRET and validated here with no network
 * call, so an open session survives the provider being down (NFR-08).
 *
 * A signed value is `<base64url JSON>.<base64url HMAC>`. The secret is passed
 * in, never read here: only config/env.ts reads the environment.
 */
export const SESSION_COOKIE = "keel_session";
export const SIGN_IN_COOKIE = "keel_sign_in";

/** The sign-in cookie is only ever read by the callback. */
const SIGN_IN_PATH = "/v1/session";

const mac = (body: string, secret: string): Buffer =>
  createHmac("sha256", secret).update(body).digest();

export function sign(value: unknown, secret: string): string {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${body}.${mac(body, secret).toString("base64url")}`;
}

/** The signed value, or null if it was not signed with `secret`. */
export function verify(signed: string, secret: string): unknown {
  const dot = signed.indexOf(".");
  if (dot <= 0 || dot !== signed.lastIndexOf(".")) return null;
  const body = signed.slice(0, dot);
  const given = Buffer.from(signed.slice(dot + 1), "base64url");
  const expected = mac(body, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** One cookie's value from a Cookie header, or null. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return part.slice(eq + 1).trim();
    }
  }
  return null;
}

/** Secure even on localhost: browsers treat http://localhost as secure. */
function setCookie(
  name: string,
  value: string,
  maxAge: number,
  path: string,
): string {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export const nowSeconds = (now: Date): number =>
  Math.floor(now.getTime() / 1000);

/** The Set-Cookie value that starts a session for `userId`. */
export function sessionCookie(
  userId: string,
  now: Date,
  secret: string,
): string {
  const payload = newSession(userId, nowSeconds(now));
  return setCookie(SESSION_COOKIE, sign(payload, secret), SESSION_SECONDS, "/");
}

export const clearSessionCookie = (): string =>
  setCookie(SESSION_COOKIE, "", 0, "/");

/** The signed-in user's id, if the request carries a live session. */
export function sessionUserId(
  cookieHeader: string | null,
  now: Date,
  secret: string,
): string | null {
  const raw = readCookie(cookieHeader, SESSION_COOKIE);
  if (!raw) return null;
  return liveSession(verify(raw, secret), nowSeconds(now))?.uid ?? null;
}

/** The Set-Cookie value that carries a sign-in to the provider and back. */
export function signInCookie(
  state: string,
  verifier: string,
  now: Date,
  secret: string,
): string {
  const payload = newSignIn(state, verifier, nowSeconds(now));
  return setCookie(
    SIGN_IN_COOKIE,
    sign(payload, secret),
    SIGN_IN_SECONDS,
    SIGN_IN_PATH,
  );
}

export const clearSignInCookie = (): string =>
  setCookie(SIGN_IN_COOKIE, "", 0, SIGN_IN_PATH);

/** The sign-in this browser started, if it is still live. */
export function readSignIn(
  cookieHeader: string | null,
  now: Date,
  secret: string,
): { state: string; verifier: string } | null {
  const raw = readCookie(cookieHeader, SIGN_IN_COOKIE);
  if (!raw) return null;
  const live = liveSignIn(verify(raw, secret), nowSeconds(now));
  return live ? { state: live.state, verifier: live.verifier } : null;
}
