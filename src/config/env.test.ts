import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env";

const valid = {
  DATABASE_URL: "postgres://keel:keel_local_dev@localhost:5432/keel",
  APP_BASE_URL: "http://localhost:3000",
  LOG_LEVEL: "info",
  SEED_DATA: "false",
  SESSION_SECRET: "0123456789abcdef0123",
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
        "SEED_DATA",
        "SESSION_SECRET",
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

  it("coerces SEED_DATA to a boolean", () => {
    expect(loadConfig({ ...valid, SEED_DATA: "true" }).seedData).toBe(true);
    expect(loadConfig({ ...valid, SEED_DATA: "false" }).seedData).toBe(false);
  });

  it("boots with the Cognito variables absent (required only from E-06)", () => {
    const c = loadConfig(valid);
    expect(c.cognito.poolId).toBeUndefined();
    expect(c.cognito.clientId).toBeUndefined();
    expect(c.cognito.clientSecret).toBeUndefined();
  });

  it("passes the Cognito variables through when present", () => {
    const c = loadConfig({
      ...valid,
      COGNITO_POOL_ID: "pool",
      COGNITO_CLIENT_ID: "client",
      COGNITO_CLIENT_SECRET: "secret",
    });
    expect(c.cognito).toEqual({
      poolId: "pool",
      clientId: "client",
      clientSecret: "secret",
    });
  });
});
