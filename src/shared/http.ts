import type { Problem, ProblemError } from "@/shared/contract";

/** A success response as application/json. */
export function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** An RFC 9457 problem response as application/problem+json (NFR-07). */
export function problem(
  status: number,
  title: string,
  type: string,
  detail?: string,
  errors?: ProblemError[],
): Response {
  const body: Problem = { type, title, status };
  if (detail) body.detail = detail;
  if (errors) body.errors = errors;
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

const PROBLEM_BASE = "https://keel.app/problems";
export const problemType = (slug: string) => `${PROBLEM_BASE}/${slug}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A path id that is not a UUID names no row: the route answers 404. */
export const isUuid = (s: string): boolean => UUID.test(s);

/** The objective's stored facts are malformed (ERD invariant 16). Ids only. */
export const malformedRecord = (): Response =>
  problem(
    500,
    "This objective's record is malformed",
    problemType("malformed-record"),
    "The objective has no status history or no plan, so it cannot be shown.",
  );

export const unavailable = (): Response =>
  problem(
    503,
    "Couldn't reach your log",
    problemType("unavailable"),
    "The database could not be reached.",
  );

export const notFound = (what: string): Response =>
  problem(404, "Not found", problemType("not-found"), `No such ${what}.`);
