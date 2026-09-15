/**
 * The one place environment variables are read (W3-11 / ADR-004).
 *
 * Everything else in the app takes config as values; nothing else reads
 * `process.env` (enforced by a lint rule — see eslint.config.mjs). Config
 * values differ between environments, but code never branches on the
 * environment *name* — there is no `if (env === "production")` anywhere, by
 * design (ADR-004).
 *
 * Validation runs at startup (src/instrumentation.ts) and fails immediately,
 * naming the exact variable that is missing or malformed, rather than letting
 * a bad value surface later as a confusing runtime error.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

export type Config = {
  databaseUrl: string;
  appBaseUrl: string;
  logLevel: LogLevel;
  seedData: boolean;
  sessionSecret: string;
  /**
   * Required from E-06 (auth). Optional until then: the app boots without
   * these. When present they are passed through; when absent, auth is simply
   * not wired up yet.
   */
  cognito: {
    poolId?: string;
    clientId?: string;
    clientSecret?: string;
  };
};

export class ConfigError extends Error {
  constructor(problems: string[]) {
    super(
      "Invalid environment configuration:\n" +
        problems.map((p) => `  - ${p}`).join("\n") +
        "\n\nSee .env.example and docs/configuration.md.",
    );
    this.name = "ConfigError";
  }
}

function optional(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  return v ? v : undefined;
}

/**
 * Read and validate the environment. Pure with respect to its `env` argument,
 * so it is testable without mutating the real process environment.
 */
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): Config {
  const problems: string[] = [];

  const required = (name: string): string => {
    const v = env[name]?.trim();
    if (!v) {
      problems.push(`${name} is required but missing or empty`);
      return "";
    }
    return v;
  };

  const databaseUrl = required("DATABASE_URL");
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    problems.push(`DATABASE_URL must be a postgres:// connection string`);
  }

  const appBaseUrl = required("APP_BASE_URL");
  if (appBaseUrl) {
    try {
      const u = new URL(appBaseUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        problems.push(`APP_BASE_URL must be an http(s) URL`);
      }
    } catch {
      problems.push(
        `APP_BASE_URL must be a valid URL (e.g. http://localhost:3000)`,
      );
    }
  }

  const logLevelRaw = required("LOG_LEVEL");
  if (logLevelRaw && !LOG_LEVELS.includes(logLevelRaw as LogLevel)) {
    problems.push(`LOG_LEVEL must be one of: ${LOG_LEVELS.join(", ")}`);
  }

  const seedRaw = required("SEED_DATA");
  if (seedRaw && seedRaw !== "true" && seedRaw !== "false") {
    problems.push(`SEED_DATA must be "true" or "false"`);
  }

  const sessionSecret = required("SESSION_SECRET");
  if (sessionSecret && sessionSecret.length < 16) {
    problems.push(`SESSION_SECRET must be at least 16 characters`);
  }

  if (problems.length > 0) {
    throw new ConfigError(problems);
  }

  return {
    databaseUrl,
    appBaseUrl,
    logLevel: logLevelRaw as LogLevel,
    seedData: seedRaw === "true",
    sessionSecret,
    cognito: {
      poolId: optional(env.COGNITO_POOL_ID),
      clientId: optional(env.COGNITO_CLIENT_ID),
      clientSecret: optional(env.COGNITO_CLIENT_SECRET),
    },
  };
}

let cached: Config | undefined;

/** The validated config, computed once. */
export function getConfig(): Config {
  cached ??= loadConfig();
  return cached;
}
