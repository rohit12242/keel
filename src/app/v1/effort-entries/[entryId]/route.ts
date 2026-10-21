import { deleteEffortEntry, updateEffortEntry } from "@/modules/effort/service";
import {
  isUuid,
  jsonResponse,
  notFound,
  problem,
  problemType,
  unavailable,
  withSession,
} from "@/shared/http";
import { withRequestLog } from "@/shared/log";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ entryId: string }> };

const notActive = () =>
  problem(
    422,
    "This objective is not active",
    problemType("objective-not-active"),
    "Effort on a paused, completed or ended objective is the record as it stood.",
  );

const notToday = () =>
  problem(
    422,
    "This entry's day is over",
    problemType("not-today"),
    "An entry is changed only on its own day, in the zone it was logged in.",
  );

/**
 * PATCH /v1/effort-entries/{entryId} — correct an entry on its own day.
 * `local_date` cannot change (docs/keel-api.yaml).
 */
export const PATCH = withSession(
  async (req: Request, ctx: Ctx, userId: string): Promise<Response> => {
    const { entryId } = await ctx.params;
    return withRequestLog(
      "PATCH /v1/effort-entries/[entryId]",
      { entry_id: entryId },
      async () => {
        if (!isUuid(entryId)) return notFound("entry");
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return problem(
            400,
            "Invalid request",
            problemType("invalid"),
            "The request body must be JSON.",
          );
        }
        try {
          const result = await updateEffortEntry(
            userId,
            entryId,
            body,
            new Date(),
          );
          if (result.ok) return jsonResponse(200, result.entry);
          switch (result.kind) {
            case "validation":
              return problem(
                400,
                "Invalid edit",
                problemType("invalid"),
                "One or more fields failed validation.",
                result.errors,
              );
            case "not_found":
              return notFound("entry");
            case "not_today":
              return notToday();
            case "not_active":
              return notActive();
            case "overlap":
              return problem(
                422,
                "Overlaps another entry",
                problemType("entry-overlaps"),
                result.detail,
              );
          }
        } catch {
          return unavailable();
        }
      },
    );
  },
);

/** DELETE /v1/effort-entries/{entryId} — the one delete Keel has (NFR-01). */
export const DELETE = withSession(
  async (_req: Request, ctx: Ctx, userId: string): Promise<Response> => {
    const { entryId } = await ctx.params;
    return withRequestLog(
      "DELETE /v1/effort-entries/[entryId]",
      { entry_id: entryId },
      async () => {
        if (!isUuid(entryId)) return notFound("entry");
        try {
          const result = await deleteEffortEntry(userId, entryId, new Date());
          if (result.ok) return new Response(null, { status: 204 });
          switch (result.kind) {
            case "not_found":
              return notFound("entry");
            case "not_today":
              return notToday();
            case "not_active":
              return notActive();
          }
        } catch {
          return unavailable();
        }
      },
    );
  },
);
