import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  clearSignInCookie,
  readCookie,
  readSignIn,
  sessionCookie,
  sessionOf,
  sessionUserId,
  sign,
  signInCookie,
  verify,
} from "./session";

const SECRET = "a-session-secret-of-some-length";
const UID = "0b6f3c1e-7d1a-4c55-9a51-6f0c2a8e9b11";
const USER = { id: UID, email: "rohit@example.com", name: "Rohit" };
const NOW = new Date("2026-10-13T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

/** The name=value part of a Set-Cookie header, as a browser would send it back. */
const sent = (setCookie: string) => setCookie.split(";")[0];

describe("sign / verify", () => {
  it("round-trips a value signed with the same secret", () => {
    expect(verify(sign({ a: 1 }, SECRET), SECRET)).toEqual({ a: 1 });
  });

  it("refuses a value signed with another secret", () => {
    expect(
      verify(sign({ a: 1 }, "another-secret-entirely"), SECRET),
    ).toBeNull();
  });

  it("refuses a tampered body", () => {
    const [, mac] = sign({ uid: UID }, SECRET).split(".");
    const forged = Buffer.from(
      JSON.stringify({ uid: "someone-else" }),
    ).toString("base64url");
    expect(verify(`${forged}.${mac}`, SECRET)).toBeNull();
  });

  it("refuses anything that is not body.mac", () => {
    for (const bad of ["", "nodot", ".mac", "a.b.c", "a.b"]) {
      expect(verify(bad, SECRET)).toBeNull();
    }
  });

  it("refuses a correctly signed body that is not JSON", () => {
    // Signed by hand, so it gets past the MAC check and fails on parsing.
    const body = Buffer.from("not json").toString("base64url");
    const mac = createHmac("sha256", SECRET).update(body).digest("base64url");
    expect(verify(`${body}.${mac}`, SECRET)).toBeNull();
  });
});

describe("readCookie", () => {
  it("finds one cookie among several", () => {
    expect(readCookie("a=1; keel_session=xyz; b=2", "keel_session")).toBe(
      "xyz",
    );
  });

  it("returns null without a header, or without that cookie", () => {
    expect(readCookie(null, "keel_session")).toBeNull();
    expect(readCookie("a=1; junk", "keel_session")).toBeNull();
  });
});

describe("the session cookie", () => {
  const set = sessionCookie(USER, NOW, SECRET);

  it("is HttpOnly, Secure, SameSite=Lax, site-wide, for thirty days", () => {
    expect(set).toMatch(
      /^keel_session=[^;]+; Path=\/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax$/,
    );
  });

  it("names its user while live", () => {
    expect(
      sessionUserId(sent(set), new Date(NOW.getTime() + 29 * DAY), SECRET),
    ).toBe(UID);
  });

  it("carries the user's email and name, read with no database", () => {
    expect(sessionOf(sent(set), NOW, SECRET)).toEqual(USER);
  });

  it("names nobody once expired, under another secret, or absent", () => {
    expect(
      sessionUserId(sent(set), new Date(NOW.getTime() + 30 * DAY), SECRET),
    ).toBeNull();
    expect(sessionUserId(sent(set), NOW, "another-secret-entirely")).toBeNull();
    expect(sessionUserId(null, NOW, SECRET)).toBeNull();
  });

  it("is cleared with an empty value and no lifetime", () => {
    expect(clearSessionCookie()).toBe(
      "keel_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    );
  });
});

describe("the sign-in cookie", () => {
  const set = signInCookie("the-state", "the-verifier", NOW, SECRET);

  it("is scoped to /v1/session and lasts ten minutes", () => {
    expect(set).toMatch(
      /; Path=\/v1\/session; Max-Age=600; HttpOnly; Secure; SameSite=Lax$/,
    );
  });

  it("carries the state and verifier back while live", () => {
    expect(readSignIn(sent(set), NOW, SECRET)).toEqual({
      state: "the-state",
      verifier: "the-verifier",
    });
  });

  it("is gone after ten minutes, or when absent", () => {
    expect(
      readSignIn(sent(set), new Date(NOW.getTime() + 600_000), SECRET),
    ).toBeNull();
    expect(readSignIn("other=1", NOW, SECRET)).toBeNull();
  });

  it("is cleared on its own path", () => {
    expect(clearSignInCookie()).toBe(
      "keel_sign_in=; Path=/v1/session; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    );
  });
});
