import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { testSigner } from "@/test/idToken";
import { verifySignature } from "./cognito";

const signer = testSigner();
const CLAIMS = { sub: "subject-1", token_use: "id" };

const part = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

describe("verifySignature", () => {
  it("returns the claims of a token signed by a published key", () => {
    expect(verifySignature(signer.token(CLAIMS), [signer.jwk])).toEqual({
      ok: true,
      claims: CLAIMS,
    });
  });

  it("refuses a token whose payload was changed after signing", () => {
    const [head, , sig] = signer.token(CLAIMS).split(".");
    const forged = `${head}.${part({ ...CLAIMS, sub: "someone-else" })}.${sig}`;
    expect(verifySignature(forged, [signer.jwk])).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("refuses a token signed by a key the pool does not publish", () => {
    const stranger = testSigner(signer.jwk.kid);
    expect(verifySignature(stranger.token(CLAIMS), [signer.jwk])).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("refuses a token naming a key that is not in the set", () => {
    const other = testSigner("another-key");
    expect(verifySignature(other.token(CLAIMS), [signer.jwk])).toEqual({
      ok: false,
      reason: "unknown_key",
    });
  });

  it("refuses alg none, and an HMAC keyed with the public key", () => {
    const body = part(CLAIMS);
    const none = `${part({ alg: "none", kid: signer.jwk.kid })}.${body}.`;
    const hsHead = part({ alg: "HS256", kid: signer.jwk.kid });
    const hs = `${hsHead}.${body}.${createHmac(
      "sha256",
      JSON.stringify(signer.jwk),
    )
      .update(`${hsHead}.${body}`)
      .digest("base64url")}`;
    for (const token of [none, hs]) {
      expect(verifySignature(token, [signer.jwk])).toEqual({
        ok: false,
        reason: "bad_signature",
      });
    }
  });

  it("refuses anything that is not a compact JWT", () => {
    for (const token of ["", "a.b", "a.b.c.d", "!!!.e30.sig"]) {
      expect(verifySignature(token, [signer.jwk])).toEqual({
        ok: false,
        reason: "malformed",
      });
    }
  });

  it("refuses a correctly signed payload that is not JSON", () => {
    expect(verifySignature(signer.raw("not json"), [signer.jwk])).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});
