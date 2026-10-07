import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { getConfig } from "@/config/env";
import { configureDbDateParsing } from "@/shared/db-types";

/**
 * The one pg Pool for the app. repo.ts files hold the SQL and call `query`;
 * they never construct their own connection. domain/ imports none of this
 * (ADR-001) — enforced by the import-boundary lint rule.
 */

// DATE columns come back as 'YYYY-MM-DD' strings, never JS Date (NFR-12). This
// registers on the pg module the moment db is first imported.
configureDbDateParsing();

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

/** Anything that runs a query: the pool, or one transaction's client. */
export type Queryable = {
  query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

/**
 * Run `fn` inside one transaction on one client: all of its writes commit, or
 * none do. The rules of what to write stay in repo.ts; this only brackets them.
 */
export async function withTransaction<T>(
  fn: (tx: Queryable) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
