import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type {
  Objective,
  Review,
  ReviewList,
  ScheduleGrid,
} from "@/shared/contract";
import { reviewHead } from "@/modules/reviews/domain/reviewView";
import { PageHeader } from "../../../../PageHeader";
import { readApi, type Read } from "../../../../readApi";
import { requireUser } from "../../../../requireUser";
import { FinalReviewForm } from "../../../review/FinalReviewForm";
import { ReviewForm } from "../../../review/ReviewForm";
import { ReviewHead } from "../../../review/ReviewHead";
import { SavedReview } from "../../../review/SavedReview";
import { Unreachable } from "../../../Screen";
import { dayAndZone } from "../../../today";

export const metadata: Metadata = { title: "Review · Keel" };

// Server-rendered per request (D-04), from the real endpoints.
export const dynamic = "force-dynamic";

const valueOf = <T,>(r: Read<T>): T | null =>
  typeof r === "object" ? r.value : null;

/**
 * One review of an objective (05-reviews.md), under the objective so
 * Objectives stays the current place. A saved review reads back; a draft is
 * the form. The review is read first: its period and the review before it
 * name the other reads, which then go together.
 */
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; reviewId: string }>;
  /** `?extend=1`: the Overview sent the user to make an owed extension (G49). */
  searchParams: Promise<{ extend?: string }>;
}) {
  const user = await requireUser();
  const { id, reviewId } = await params;
  const { extend } = await searchParams;
  const { today, tz } = await dayAndZone(user);

  const read = await readApi<Review>(
    `/reviews/${encodeURIComponent(reviewId)}`,
  );
  if (read === "signed_out") redirect("/sign-in");
  // Unknown, or someone else's (NFR-10): back to the objective.
  if (read === "not_found") redirect(`/objectives/${encodeURIComponent(id)}`);
  if (read === "unreachable") return <Failed />;
  const review = read.value;
  if (review.objective_id !== id) {
    redirect(`/objectives/${review.objective_id}/reviews/${review.id}`);
  }

  const [objective, list, grid, previous] = await Promise.all([
    readApi<Objective>(`/objectives/${id}`),
    readApi<ReviewList>(`/objectives/${id}/reviews`),
    readApi<ScheduleGrid>(
      `/objectives/${id}/schedule?from=${review.period_start}&to=${review.period_end}`,
    ),
    review.previous_review_id
      ? readApi<Review>(`/reviews/${review.previous_review_id}`)
      : Promise.resolve(null),
  ]);
  if ([objective, list, grid, previous].includes("signed_out")) {
    redirect("/sign-in");
  }
  const o = valueOf(objective);
  const reviews = valueOf(list);
  if (!o || !reviews) return <Failed />;

  const head = reviewHead(review, o, tz, today);
  const saved = review.status === "saved";
  const back = saved
    ? { href: `/objectives/${id}?tab=reviews`, label: `${o.title} · Reviews` }
    : { href: `/objectives/${id}`, label: o.title };

  const previousReview = previous ? valueOf(previous) : null;
  const days = valueOf(grid)?.days ?? null;

  // The final review: the whole plan, the criteria, and what next (I-14).
  if (review.kind === "plan_end" && !saved) {
    return (
      <FinalReviewForm
        key={review.id}
        review={review}
        previous={previousReview}
        objective={o}
        head={head}
        back={back}
        tz={tz}
        today={today}
      />
    );
  }

  if (!saved) {
    const others = reviews.due.filter(
      (d) =>
        d.period_start !== review.period_start ||
        d.period_end !== review.period_end,
    );
    return (
      <ReviewForm
        key={review.id}
        review={review}
        previous={previousReview}
        grid={days}
        head={head}
        back={back}
        objectiveId={id}
        moreDue={others.length}
        tz={tz}
        today={today}
      />
    );
  }

  return (
    <>
      <ReviewHead head={head} back={back} />
      <SavedReview
        review={review}
        previous={previousReview}
        grid={days}
        list={reviews.reviews}
        due={reviews.due}
        objective={o}
        extend={extend === "1"}
        today={today}
      />
    </>
  );
}

function Failed() {
  return (
    <>
      <PageHeader title="Review" />
      <Unreachable />
    </>
  );
}
