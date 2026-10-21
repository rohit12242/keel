import type { Deviation, ProblemError } from "@/shared/contract";
import { parseVerdict, verdictDecision } from "./domain/deviationVerdict";
import { withTransaction } from "@/shared/db";
import { validateReviewEdit } from "./domain/reviewWrite";
import { saveDecision } from "./domain/saveReview";
import { insertStatusEvent, lockObjective } from "@/modules/objectives/repo";
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
import { dueWindows, periodKey, reviewSchedule } from "./domain/reviewWindows";
import {
  deleteDraft,
  getReviewFacts,
  insertDraft,
  lockDeviation,
  lockReview,
  markSaved,
  setDeviationVerdict,
  updateReviewAnswers,
  type ObjectiveReviewFacts,
} from "./repo";

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

/** A window that is due, as the Reviews tab lists it (G19). */
export type DueReview = {
  label: string;
  kind: "weekly" | "monthly" | "plan_end";
  period_start: string;
  period_end: string;
  /** The draft started for this window, or null. */
  review_id: string | null;
};

/**
 * The Reviews tab: every review of the objective, in period order, and every
 * window that is due — started or not — so the tab shows one card per owed
 * review without working out windows itself (G19). The same windows
 * `reviews_due` counts.
 */
export async function listReviews(
  userId: string,
  objectiveId: string,
  now: Date,
): Promise<{ reviews: ReviewSummary[]; due: DueReview[] } | null> {
  const raw = await getReviewFacts(null, userId, { objectiveId });
  if (!raw) return null;
  const { facts, status, today } = contextOf(raw, now);
  const saved = facts.reviews.filter((r) => r.status === "saved");
  const due = dueWindows({
    schedule: facts.schedule,
    today,
    status,
    saved: new Set(saved.map(periodKey)),
    slots: facts.slots,
  });
  return {
    reviews: facts.reviews.map((r) => summaryOf(r, facts)),
    due: due.map((w) => ({
      label: w.label,
      kind: w.kind,
      period_start: w.period_start,
      period_end: w.period_end,
      review_id:
        facts.reviews.find(
          (r) => r.status === "draft" && periodKey(r) === periodKey(w),
        )?.id ?? null,
    })),
  };
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

export type UpdateResult =
  | { ok: true; review: Review }
  | { ok: false; kind: "invalid"; errors: ProblemError[] }
  | { ok: false; kind: "plan_end_only"; fields: string[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "saved" };

/** Autosave a draft. A saved review is the record of what you concluded, and never changes. */
export async function updateReview(
  userId: string,
  reviewId: string,
  body: unknown,
  now: Date,
): Promise<UpdateResult> {
  const outcome = await withTransaction(
    async (tx): Promise<UpdateResult | null> => {
      const review = await lockReview(tx, userId, reviewId);
      if (!review) return { ok: false, kind: "not_found" };
      if (review.status === "saved") return { ok: false, kind: "saved" };
      const edit = validateReviewEdit(body, review.kind);
      if (!edit.ok) return edit;
      await updateReviewAnswers(tx, reviewId, edit.value);
      return null;
    },
  );
  if (outcome) return outcome;
  return {
    ok: true,
    review: (await getReview(userId, reviewId, now)) as Review,
  };
}

export type DiscardResult =
  | { ok: true }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "saved" };

/** Discard a draft. A saved review is never deleted (invariant 17). */
export async function discardReview(
  userId: string,
  reviewId: string,
): Promise<DiscardResult> {
  return withTransaction(async (tx): Promise<DiscardResult> => {
    const review = await lockReview(tx, userId, reviewId);
    if (!review) return { ok: false, kind: "not_found" };
    if (review.status === "saved") return { ok: false, kind: "saved" };
    await deleteDraft(tx, reviewId);
    return { ok: true };
  });
}

export type VerdictResult =
  | { ok: true; deviation: Deviation }
  | { ok: false; kind: "invalid" }
  | { ok: false; kind: "not_found"; what: "review" | "deviation" }
  | { ok: false; kind: "not_judgeable"; detail: string }
  | { ok: false; kind: "conflict"; detail: string };

/** A review judges a chosen deviation of its period (invariant 12). */
export async function setVerdict(
  userId: string,
  reviewId: string,
  deviationId: string,
  body: unknown,
): Promise<VerdictResult> {
  const verdict = parseVerdict(body);
  if (!verdict) return { ok: false, kind: "invalid" };
  return withTransaction(async (tx): Promise<VerdictResult> => {
    const review = await lockReview(tx, userId, reviewId);
    if (!review) return { ok: false, kind: "not_found", what: "review" };
    const row = await lockDeviation(tx, userId, deviationId);
    if (!row) return { ok: false, kind: "not_found", what: "deviation" };
    const decision = verdictDecision(review, present(row), verdict);
    switch (decision.kind) {
      case "unchanged":
        return { ok: true, deviation: present(row) };
      case "write":
        return {
          ok: true,
          deviation: present(
            await setDeviationVerdict(tx, deviationId, verdict, reviewId),
          ),
        };
      case "not_judgeable":
        return { ok: false, kind: "not_judgeable", detail: decision.detail };
      case "judged_elsewhere":
        return {
          ok: false,
          kind: "conflict",
          detail:
            "An earlier review already judged this deviation, and that stands.",
        };
      case "review_saved":
        return {
          ok: false,
          kind: "conflict",
          detail: "This review is saved; nothing changes it now.",
        };
    }
  });
}

export type SaveResult =
  | { ok: true; review: Review }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "already_saved" }
  | { ok: false; kind: "refused"; detail: string };

/**
 * Save a review. Checked against the record with the review and its
 * objective locked, so a verdict, a deviation or a status change cannot slip
 * in between the check and the save. The objective lock is the one
 * createStatusChange takes, so a plan-end outcome and a status change are
 * checked one after the other, never both against the same history.
 */
export async function saveReview(
  userId: string,
  reviewId: string,
  now: Date,
): Promise<SaveResult> {
  const outcome = await withTransaction(
    async (tx): Promise<SaveResult | null> => {
      const locked = await lockReview(tx, userId, reviewId);
      if (!locked) return { ok: false, kind: "not_found" };
      await lockObjective(tx, userId, locked.objective_id);
      const raw = (await getReviewFacts(tx, userId, {
        reviewId,
      })) as ObjectiveReviewFacts;
      const { facts } = contextOf(raw, now);
      const decision = saveDecision(locked, facts, raw.status_events);
      switch (decision.kind) {
        case "already_saved":
          return { ok: false, kind: "already_saved" };
        case "refused":
          return { ok: false, kind: "refused", detail: decision.detail };
        case "save":
          await markSaved(tx, reviewId, decision.previous_review_id);
          // Invariant 7: the outcome is applied in the same transaction, so
          // the review and the status history cannot disagree.
          if (decision.status_event) {
            await insertStatusEvent(
              tx,
              locked.objective_id,
              decision.status_event.change,
              decision.status_event.occurred_on,
              null,
            );
          }
          return null;
      }
    },
  );
  if (outcome) return outcome;
  return {
    ok: true,
    review: (await getReview(userId, reviewId, now)) as Review,
  };
}
