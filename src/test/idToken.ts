import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import type { SigningKey } from "@/modules/session/cognito";

/**
 * A signing key of the kind Cognito publishes, and ID tokens signed with it,
 * so the exchange can be tested end to end without reaching Cognito. Tests
 * only.
 */
export type TestSigner = {
  /** The public half, as it appears in the pool's JWKS. */
  jwk: SigningKey;
  /** A compact JWT over `claims`; the header can be overridden. */
  token: (claims: object, header?: object) => string;
  /** The same over a payload given as raw text, JSON or not. */
  raw: (payload: string) => string;
};

const part = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

export function testSigner(kid = "test-key"): TestSigner {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256" },
    token: (claims, header = {}) =>
      signed(privateKey, part(claims), header, kid),
    raw: (payload) =>
      signed(privateKey, Buffer.from(payload).toString("base64url"), {}, kid),
  };
}

function signed(
  key: KeyObject,
  body: string,
  header: object,
  kid: string,
): string {
  const head = part({ alg: "RS256", kid, ...header });
  const signature = sign("RSA-SHA256", Buffer.from(`${head}.${body}`), key);
  return `${head}.${body}.${signature.toString("base64url")}`;
}
