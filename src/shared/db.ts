import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { getConfig } from "@/config/env";

/**
 * The one pg Pool for the app. repo.ts files hold the SQL and call `query`;
 * they never construct their own connection. domain/ imports none of this
 * (ADR-001) — enforced by the import-boundary lint rule.
 */
let pool: Pool | undefined;

export function getPool(): Pool {
  pool ??= new Pool({ connectionString: getConfig().databaseUrl });
  return pool;
}

export function query<T extends QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[]);
}
