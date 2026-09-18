import { types } from "pg";

/**
 * NFR-12 off-by-one guard (the kept half).
 *
 * pg's default parser turns a DATE column (OID 1082) into a JavaScript `Date`
 * at LOCAL midnight. Serialise that Date in a different zone and the calendar
 * day silently slips to the previous or next one — the classic off-by-one that
 * passes every test written in UTC and only shows up for a user east of the
 * line or a server west of it.
 *
 * Keel stores the day a row belongs to as a real `date`, and that day must
 * depend only on what the client sent — never on the runtime's zone. So we tell
 * pg to hand DATE back as the raw 'YYYY-MM-DD' string, for every query, and
 * never build a `Date` from it. The repos already `to_char` their dates; this
 * makes the guarantee global, so a future query that forgets to can't
 * reintroduce the bug.
 */
export function configureDbDateParsing(): void {
  types.setTypeParser(types.builtins.DATE, (value) => value);
}
