/**
 * Structured logging (W3-16). One JSON line per event, with a stable
 * `logger:"keel"` and an `event` — grep either to find them.
 *
 * NFR-11: entry text, note text and deviation reasoning must NEVER appear in a
 * log line. Pass ids and types only. This module makes no attempt to redact —
 * callers are responsible for never handing it free text.
 */
export type LogValue = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogValue>;

export function logLine(event: string, fields: LogFields = {}): void {
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    logger: "keel",
    event,
  };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) record[k] = v;
  }
  console.log(JSON.stringify(record));
}

/**
 * Run a route handler and emit exactly one searchable line per request:
 * `event:"http_request"` with the route, any ids/types the caller passes,
 * the response status, and the duration. No request body is logged.
 */
export async function withRequestLog(
  route: string,
  ids: LogFields,
  run: () => Promise<Response>,
): Promise<Response> {
  const start = performance.now();
  let status = 0;
  try {
    const res = await run();
    status = res.status;
    return res;
  } finally {
    logLine("http_request", {
      route,
      ...ids,
      status,
      ms: Math.round(performance.now() - start),
    });
  }
}
