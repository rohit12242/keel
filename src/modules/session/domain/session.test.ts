import { describe, expect, it } from "vitest";
import {
  checkIdClaims,
  displayName,
  exchangeBody,
  FRESH_SIGN_IN_SECONDS,
  issuerFor,
  liveSession,
  newSession,
  SESSION_SECONDS,
  signInDecision,
} from "./session";

const NOW = 1_800_000_000;
const UID = "0b6f3c1e-7d1a-4c55-9a51-6f0c2a8e9b11";
const USER = { id: UID, email: "rohit@example.com", name: "Rohit" };

describe("the session", () => {
  it("lasts thirty days, comfortably over ADR-002's seven", () => {
    expect(SESSION_SECONDS).toBeGreaterThanOrEqual(7 * 24 * 60 * 60);
    expect(newSession(USER, NOW)).toEqual({
      uid: UID,
      email: "rohit@example.com",
      name: "Rohit",
      exp: NOW + SESSION_SECONDS,
    });
  });

  it("is live until its expiry, and not at it", () => {
    const s = newSession(USER, NOW);
    expect(liveSession(s, s.exp - 1)).toEqual(s);
    expect(liveSession(s, s.exp)).toBeNull();
  });

  it("may carry no name", () => {
    const s = newSession({ ...USER, name: null }, NOW);
    expect(liveSession(s, NOW)).toEqual(s);
  });

  it("refuses a cookie from before I-04, which carried no email or name", () => {
    expect(liveSession({ uid: UID, exp: NOW + 1 }, NOW)).toBeNull();
  });

  it("refuses a payload that is not a session, even if Keel signed it", () => {
    const good = { uid: UID, email: "r@example.com", name: "R", exp: NOW + 1 };
    for (const bad of [
      null,
      "x",
      [UID, NOW + 1],
      { ...good, uid: "not-a-uuid" },
      { ...good, uid: 7 },
      { ...good, exp: "soon" },
      { ...good, exp: 1.5 },
      { ...good, exp: undefined },
      { ...good, email: undefined },
      { ...good, email: "no-at-sign" },
      { ...good, name: undefined },
      { ...good, name: 42 },
    ]) {
      expect(liveSession(bad, NOW)).toBeNull();
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

describe("exchangeBody", () => {
  const fields = (body: unknown) => {
    const r = exchangeBody(body);
    return r.ok ? [] : r.error.map((e) => e.field);
  };

  it("takes the ID token and the browser's zone", () => {
    expect(exchangeBody({ id_token: "a.b.c", tz: "Asia/Kolkata" })).toEqual({
      ok: true,
      value: { idToken: "a.b.c", tz: "Asia/Kolkata" },
    });
  });

  it("names a missing, empty or non-string token", () => {
    for (const id_token of [undefined, "", 7]) {
      expect(fields({ id_token, tz: "UTC" })).toEqual(["id_token"]);
    }
  });

  it("names a missing, empty or unknown zone", () => {
    for (const tz of [undefined, "", "Mars/Olympus", 5]) {
      expect(fields({ id_token: "a.b.c", tz })).toEqual(["tz"]);
    }
  });

  it("names both, for a body that is not an object or has neither", () => {
    for (const body of [null, "x", [], {}]) {
      expect(fields(body)).toEqual(["id_token", "tz"]);
    }
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
    auth_time: NOW - 10,
    sub: "subject-1",
    email: "rohit@example.com",
    email_verified: true,
    name: "Rohit",
  };

  it("accepts a good token and returns who signed in", () => {
    expect(checkIdClaims(good, expected, NOW)).toEqual({
      ok: true,
      value: {
        subject: "subject-1",
        email: "rohit@example.com",
        name: "Rohit",
      },
    });
  });

  it("returns no name for an account without one", () => {
    for (const name of [undefined, 42]) {
      const r = checkIdClaims({ ...good, name }, expected, NOW);
      expect(r.ok && r.value.name).toBeNull();
    }
  });

  it("allows a sign-in exactly five minutes old, and not a second older", () => {
    expect(FRESH_SIGN_IN_SECONDS).toBe(300);
    const at = (auth_time: number) =>
      checkIdClaims({ ...good, auth_time }, expected, NOW);
    expect(at(NOW - 300).ok).toBe(true);
    expect(at(NOW - 301)).toEqual({ ok: false, error: "stale_sign_in" });
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
    ["no auth_time", { ...good, auth_time: undefined }, "malformed"],
    [
      "an auth_time that is not seconds",
      { ...good, auth_time: "now" },
      "malformed",
    ],
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

describe("displayName", () => {
  it("is the name Cognito holds", () => {
    expect(displayName("Rohit", "r@example.com")).toBe("Rohit");
  });

  it("is the email before the @ when there is no name, or only spaces", () => {
    expect(displayName(null, "rohit.y@example.com")).toBe("rohit.y");
    expect(displayName("  ", "rohit.y@example.com")).toBe("rohit.y");
  });
});

describe("signInDecision", () => {
  const identity = {
    subject: "subject-1",
    email: "rohit@example.com",
    name: "Rohit",
  };

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
