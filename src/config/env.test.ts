import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env";

const valid = {
  DATABASE_URL: "postgres://keel:keel_local_dev@localhost:5432/keel",
  APP_BASE_URL: "http://localhost:3000",
  LOG_LEVEL: "info",
  SESSION_SECRET: "0123456789abcdef0123",
  COGNITO_POOL_ID: "us-east-1_AbC123",
  COGNITO_CLIENT_ID: "client",
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
        "COGNITO_POOL_ID",
        "COGNITO_CLIENT_ID",
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

  it("passes the pool and the public client through, and nothing else", () => {
    expect(loadConfig(valid).cognito).toEqual({
      poolId: "us-east-1_AbC123",
      clientId: "client",
    });
  });

  it("no longer needs the hosted domain or a client secret (I-04)", () => {
    const c = loadConfig({
      ...valid,
      COGNITO_DOMAIN: "https://keel-1.auth.us-east-1.amazoncognito.com",
      COGNITO_CLIENT_SECRET: "secret",
    });
    expect(c.cognito).toEqual(loadConfig(valid).cognito);
  });

  it("rejects a COGNITO_POOL_ID with no region", () => {
    expect(() => loadConfig({ ...valid, COGNITO_POOL_ID: "pool" })).toThrow(
      /COGNITO_POOL_ID/,
    );
  });
});
