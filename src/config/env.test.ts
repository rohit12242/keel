import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env";

const valid = {
  DATABASE_URL: "postgres://keel:keel_local_dev@localhost:5432/keel",
  APP_BASE_URL: "http://localhost:3000",
  LOG_LEVEL: "info",
  SESSION_SECRET: "0123456789abcdef0123",
  COGNITO_DOMAIN: "https://keel-1.auth.us-east-1.amazoncognito.com",
  COGNITO_POOL_ID: "us-east-1_AbC123",
  COGNITO_CLIENT_ID: "client",
  COGNITO_CLIENT_SECRET: "secret",
};

describe("loadConfig", () => {
  it("names every missing required variable", () => {
    try {
      loadConfig({});
      throw new Error("expected loadConfig to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      const msg = (e as Error).message;
      for (const name of [
        "DATABASE_URL",
        "APP_BASE_URL",
        "LOG_LEVEL",
        "SESSION_SECRET",
        "COGNITO_DOMAIN",
        "COGNITO_POOL_ID",
        "COGNITO_CLIENT_ID",
        "COGNITO_CLIENT_SECRET",
      ]) {
        expect(msg).toContain(name);
      }
    }
  });

  it("rejects a malformed DATABASE_URL, naming it", () => {
    expect(() => loadConfig({ ...valid, DATABASE_URL: "mysql://x" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a too-short SESSION_SECRET", () => {
    expect(() => loadConfig({ ...valid, SESSION_SECRET: "short" })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it("passes the Cognito variables through, the domain without a trailing slash", () => {
    const c = loadConfig({
      ...valid,
      COGNITO_DOMAIN: "https://keel-1.auth.us-east-1.amazoncognito.com/",
    });
    expect(c.cognito).toEqual({
      domain: "https://keel-1.auth.us-east-1.amazoncognito.com",
      poolId: "us-east-1_AbC123",
      clientId: "client",
      clientSecret: "secret",
    });
  });

  it("rejects a COGNITO_DOMAIN that is not an https origin", () => {
    for (const bad of [
      "http://keel-1.auth.us-east-1.amazoncognito.com",
      "https://keel-1.auth.us-east-1.amazoncognito.com/login",
      "keel-1",
    ]) {
      expect(() => loadConfig({ ...valid, COGNITO_DOMAIN: bad })).toThrow(
        /COGNITO_DOMAIN/,
      );
    }
  });

  it("rejects a COGNITO_POOL_ID with no region", () => {
    expect(() => loadConfig({ ...valid, COGNITO_POOL_ID: "pool" })).toThrow(
      /COGNITO_POOL_ID/,
    );
  });
});
