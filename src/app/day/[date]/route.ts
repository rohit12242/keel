import { getDay } from "@/modules/today/service";
import { jsonResponse, problem, problemType } from "@/shared/http";

// Reads the database per request; never prerendered.
export const dynamic = "force-dynamic";

function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * GET /day/{date} — everything the Today screen needs, in one query
 * (docs/keel-api.yaml, NFR-03). No auth yet (E-06); the current user is the
 * seeded user, resolved in the service.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ date: string }> },
): Promise<Response> {
  const { date } = await ctx.params;

  if (!isIsoDate(date)) {
    return problem(
      400,
      "Invalid date",
      problemType("invalid"),
      "The date must be a valid calendar date in YYYY-MM-DD form.",
      [{ field: "date", message: "Must be YYYY-MM-DD." }],
    );
  }

  try {
    return jsonResponse(200, await getDay(date));
  } catch {
    // The database could not be reached (NFR-07 / contract 503).
    return problem(
      503,
      "Couldn't reach your log",
      problemType("unavailable"),
      "The database could not be reached.",
    );
  }
}
