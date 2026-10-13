import type { ProblemError } from "@/shared/contract";
import { isIsoDate } from "@/modules/effort/domain/validateWrite";
import { planSlots } from "@/modules/objectives/domain/planSlots";
import { toSegment } from "@/modules/objectives/domain/segmentRows";
import {
  currentStatus,
  type ObjectiveStatus,
} from "@/modules/objectives/domain/statusTimeline";
import { present } from "@/modules/deviations/service";
import { localDayOf } from "@/shared/time/localDay";
import {
  assembleReview,
  startDecision,
  summaryOf,
  type Review,
  type ReviewFacts,
  type ReviewRow,
  type ReviewSummary,
  type StartRequest,
} from "./domain/assembleReview";
import { reviewSchedule } from "./domain/reviewWindows";
import { getReviewFacts, insertDraft, type ObjectiveReviewFacts } from "./repo";

/**
 * reviews/service — one function per use case (ADR-001). Every read is the
 * one facts query; "today" is read in the caller's zone.
 */

export type Context = {
  facts: ReviewFacts;
  status: ObjectiveStatus | null;
  today: string;
  raw: ObjectiveReviewFacts;
};

export function contextOf(raw: ObjectiveReviewFacts, now: Date): Context {
  const slots = planSlots(raw.segments.map(toSegment), raw.status_events);
  return {
    raw,
    status: currentStatus(raw.status_events),
    today: localDayOf(now, raw.user_tz),
    facts: {
      schedule: reviewSchedule(raw.review_cadence, raw.segments),
      slots,
      daily: Object.fromEntries(
        raw.daily_minutes.map((d) => [d.local_date, d.minutes]),
      ),
      reviews: raw.reviews,
      deviations: raw.deviations.map(present),
      ideas: raw.ideas,
    },
  };
}

/** The Reviews tab: every review of the objective, in period order. */
export async function listReviews(
  userId: string,
  objectiveId: string,
  now: Date,
): Promise<ReviewSummary[] | null> {
  const raw = await getReviewFacts(null, userId, { objectiveId });
  if (!raw) return null;
  const { facts } = contextOf(raw, now);
  return facts.reviews.map((r) => summaryOf(r, facts));
}

/** One review, its figures recomputed now. */
export async function getReview(
  userId: string,
  reviewId: string,
  now: Date,
): Promise<Review | null> {
  const raw = await getReviewFacts(null, userId, { reviewId });
  if (!raw) return null;
  const { facts } = contextOf(raw, now);
  const review = facts.reviews.find((r) => r.id === reviewId) as ReviewRow;
  return assembleReview(review, facts);
}

/** An optional `{ period_start, period_end }`: both or neither. */
export function parseStartBody(
  body: unknown,
): { ok: true; request: StartRequest } | { ok: false; errors: ProblemError[] } {
  if (body === undefined || body === null) return { ok: true, request: null };
  const b =
    typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  if (b === null) {
    return {
      ok: false,
      errors: [{ field: "body", message: "Must be a JSON object." }],
    };
  }
  if (b.period_start === undefined && b.period_end === undefined) {
    return { ok: true, request: null };
  }
  const errors: ProblemError[] = [];
  for (const f of ["period_start", "period_end"] as const) {
    const v = b[f];
    if (typeof v !== "string" || !isIsoDate(v)) {
      errors.push({ field: f, message: "YYYY-MM-DD; both dates or neither." });
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    request: {
      period_start: b.period_start as string,
      period_end: b.period_end as string,
    },
  };
}

export type StartResult =
  | { ok: true; created: boolean; review: Review }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "saved" }
  | { ok: false; kind: "nothing_due" };

/**
 * Start or resume the review for a period: with no body, the one due now.
 * Idempotent — the same draft comes back, created only the first time.
 */
export async function startReview(
  userId: string,
  objectiveId: string,
  body: unknown,
  now: Date,
): Promise<StartResult> {
  const parsed = parseStartBody(body);
  if (!parsed.ok) return { ok: false, kind: "invalid", errors: parsed.errors };
  const raw = await getReviewFacts(null, userId, { objectiveId });
  if (!raw) return { ok: false, kind: "not_found" };
  const ctx = contextOf(raw, now);
  const decision = startDecision({
    request: parsed.request,
    schedule: ctx.facts.schedule,
    reviews: ctx.facts.reviews,
    slots: ctx.facts.slots,
    status: ctx.status,
    today: ctx.today,
  });
  switch (decision.kind) {
    case "resume":
      return {
        ok: true,
        created: false,
        review: assembleReview(decision.review, ctx.facts),
      };
    case "create": {
      const { id, created } = await insertDraft(objectiveId, decision.window);
      const review = (await getReview(userId, id, now)) as Review;
      return { ok: true, created, review };
    }
    case "saved":
      return { ok: false, kind: "saved" };
    case "nothing_due":
      return { ok: false, kind: "nothing_due" };
    case "not_a_window":
      return {
        ok: false,
        kind: "invalid",
        errors: [
          {
            field: "period_start",
            message: "Not a review window of this objective.",
          },
        ],
      };
    case "not_closed":
      return {
        ok: false,
        kind: "invalid",
        errors: [
          {
            field: "period_end",
            message:
              "This window has not closed yet; it is reviewed from its last day.",
          },
        ],
      };
  }
}
