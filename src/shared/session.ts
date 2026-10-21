import { createHmac, timingSafeEqual } from "node:crypto";
import {
  liveSession,
  newSession,
  SESSION_SECONDS,
  type SignedIn,
} from "@/modules/session/domain/session";

/**
 * Keel's own cookie (ADR-002), `keel_session`: HMAC-SHA256 signed with
 * SESSION_SECRET and validated here with no network call, so an open session
 * survives Cognito being down (NFR-08).
 *
 * A signed value is `<base64url JSON>.<base64url HMAC>`. The secret is passed
 * in, never read here: only config/env.ts reads the environment.
 */
export const SESSION_COOKIE = "keel_session";

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

/** The Set-Cookie value that starts a session for `user`. */
export function sessionCookie(
  user: SignedIn,
  now: Date,
  secret: string,
): string {
  const payload = newSession(user, nowSeconds(now));
  return setCookie(SESSION_COOKIE, sign(payload, secret), SESSION_SECONDS, "/");
}

export const clearSessionCookie = (): string =>
  setCookie(SESSION_COOKIE, "", 0, "/");

/** The signed-in user, if the request carries a live session. */
export function sessionOf(
  cookieHeader: string | null,
  now: Date,
  secret: string,
): SignedIn | null {
  const raw = readCookie(cookieHeader, SESSION_COOKIE);
  if (!raw) return null;
  const live = liveSession(verify(raw, secret), nowSeconds(now));
  return live ? { id: live.uid, email: live.email, name: live.name } : null;
}

/** The signed-in user's id, if the request carries a live session. */
export const sessionUserId = (
  cookieHeader: string | null,
  now: Date,
  secret: string,
): string | null => sessionOf(cookieHeader, now, secret)?.id ?? null;
