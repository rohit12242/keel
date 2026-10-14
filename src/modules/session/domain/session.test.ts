import { describe, expect, it } from "vitest";
import {
  checkIdClaims,
  issuerFor,
  liveSession,
  liveSignIn,
  newSession,
  newSignIn,
  SESSION_SECONDS,
  SIGN_IN_SECONDS,
  signInDecision,
} from "./session";

const NOW = 1_800_000_000;
const UID = "0b6f3c1e-7d1a-4c55-9a51-6f0c2a8e9b11";

describe("the session", () => {
  it("lasts thirty days, comfortably over ADR-002's seven", () => {
    expect(SESSION_SECONDS).toBeGreaterThanOrEqual(7 * 24 * 60 * 60);
    expect(newSession(UID, NOW)).toEqual({
      uid: UID,
      exp: NOW + SESSION_SECONDS,
    });
  });

  it("is live until its expiry, and not at it", () => {
    const s = newSession(UID, NOW);
    expect(liveSession(s, s.exp - 1)).toEqual(s);
    expect(liveSession(s, s.exp)).toBeNull();
  });

  it("refuses a payload that is not a session, even if Keel signed it", () => {
    for (const bad of [
      null,
      "x",
      [UID, NOW + 1],
      { uid: "not-a-uuid", exp: NOW + 1 },
      { uid: 7, exp: NOW + 1 },
      { uid: UID, exp: "soon" },
      { uid: UID, exp: 1.5 },
      { uid: UID },
    ]) {
      expect(liveSession(bad, NOW)).toBeNull();
    }
  });
});

describe("the sign-in cookie", () => {
  it("lasts ten minutes", () => {
    expect(newSignIn("s", "v", NOW)).toEqual({
      state: "s",
      verifier: "v",
      exp: NOW + SIGN_IN_SECONDS,
    });
  });

  it("is live until its expiry", () => {
    const s = newSignIn("s", "v", NOW);
    expect(liveSignIn(s, NOW)).toEqual(s);
    expect(liveSignIn(s, s.exp)).toBeNull();
  });

  it("refuses a payload missing its state or verifier", () => {
    for (const bad of [
      undefined,
      { state: "", verifier: "v", exp: NOW + 1 },
      { state: "s", verifier: "", exp: NOW + 1 },
      { state: 1, verifier: "v", exp: NOW + 1 },
      { state: "s", verifier: null, exp: NOW + 1 },
      { state: "s", verifier: "v", exp: 0 },
    ]) {
      expect(liveSignIn(bad, NOW)).toBeNull();
    }
  });
});

describe("issuerFor", () => {
  it("names the pool's region from its id", () => {
    expect(issuerFor("ap-south-1_AbC123")).toBe(
      "https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_AbC123",
    );
  });
});

describe("checkIdClaims", () => {
  const expected = {
    issuer: issuerFor("us-east-1_AbC123"),
    clientId: "client",
  };
  const good = {
    iss: expected.issuer,
    aud: "client",
    token_use: "id",
    exp: NOW + 3600,
    sub: "subject-1",
    email: "rohit@example.com",
    email_verified: true,
  };

  it("accepts a good token and returns who signed in", () => {
    expect(checkIdClaims(good, expected, NOW)).toEqual({
      ok: true,
      value: { subject: "subject-1", email: "rohit@example.com" },
    });
  });

  it('accepts email_verified sent as the string "true"', () => {
    const r = checkIdClaims({ ...good, email_verified: "true" }, expected, NOW);
    expect(r.ok).toBe(true);
  });

  it.each([
    ["not an object", null, "malformed"],
    [
      "another pool's token",
      { ...good, iss: issuerFor("us-east-1_Other") },
      "wrong_issuer",
    ],
    ["another client's token", { ...good, aud: "other" }, "wrong_audience"],
    ["an access token", { ...good, token_use: "access" }, "not_an_id_token"],
    ["an expired token", { ...good, exp: NOW }, "expired"],
    ["a token with no expiry", { ...good, exp: undefined }, "expired"],
    ["no subject", { ...good, sub: "" }, "malformed"],
    ["a subject that is not a string", { ...good, sub: 42 }, "malformed"],
    ["no email", { ...good, email: undefined }, "malformed"],
    ["an email with no @", { ...good, email: "rohit" }, "malformed"],
    [
      "an unverified email",
      { ...good, email_verified: false },
      "email_not_verified",
    ],
    [
      "no email_verified",
      { ...good, email_verified: undefined },
      "email_not_verified",
    ],
  ])("refuses %s", (_name, claims, reason) => {
    expect(checkIdClaims(claims, expected, NOW)).toEqual({
      ok: false,
      error: reason,
    });
  });
});

describe("signInDecision", () => {
  const identity = { subject: "subject-1", email: "rohit@example.com" };

  it("uses the user the subject already belongs to", () => {
    expect(signInDecision(identity, { id: UID })).toEqual({
      kind: "use",
      userId: UID,
    });
  });

  it("creates a user when the subject is new — never matching by email", () => {
    expect(signInDecision(identity, null)).toEqual({
      kind: "create",
      identity,
    });
  });
});
