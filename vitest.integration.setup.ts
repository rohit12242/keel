import { configureDbDateParsing } from "@/shared/db-types";

/**
 * Runs before every *.itest.ts file.
 *
 * NFR-12's DATE-as-string guard (W3-19) is registered on pg's process-global type
 * registry by whichever entry point starts first — `shared/db` for the app,
 * `scripts/migrate.mjs` and `scripts/seed.mjs` for those. An integration suite
 * that talks to pg directly has no such entry point, so it used to get pg's
 * default parser: a DATE became a JS Date at LOCAL midnight, which under
 * TZ=Asia/Kolkata reads as the previous day. That is the off-by-one these suites
 * exist to catch, so the guard belongs here rather than in each file's beforeAll,
 * where it is only as reliable as remembering it.
 */
configureDbDateParsing();
