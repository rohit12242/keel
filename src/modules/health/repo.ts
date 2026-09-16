import { query } from "@/shared/db";

/**
 * health/repo — the only file with SQL here (ADR-001). A trivial round trip
 * that proves the database answers. Returns false rather than throwing so the
 * health route can report "unreachable" instead of erroring.
 */
export async function pingDatabase(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
