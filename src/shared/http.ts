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
