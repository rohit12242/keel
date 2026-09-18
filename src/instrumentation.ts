import { loadConfig } from "@/config/env";
import { configureDbDateParsing } from "@/shared/db-types";

/**
 * Next.js runs this once when the server starts, before it handles any request.
 * Validating config here makes a misconfigured environment fail immediately at
 * startup — naming the offending variable — rather than surfacing later as a
 * confusing runtime error (W3-11).
 *
 * We also register the DATE parser here (NFR-12), so it is set at server
 * startup — before the first query — and does not depend on which module
 * happens to import `shared/db` first. `db.ts` registers it too (belt and
 * suspenders); both are idempotent.
 */
export function register() {
  loadConfig();
  configureDbDateParsing();
}
