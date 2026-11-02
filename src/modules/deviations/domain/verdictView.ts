import type { Deviation } from "@/shared/contract";

/**
 * Where a deviation's verdict can be read (G47; ADR-001 domain: pure). A
 * verdict is written while its review is still a draft. Outside that review
 * it reads only once the review is saved, so the Deviations page and Today
 * never show a judgement that a discard could still take back. Inside the
 * draft that gave it, it reads as given.
 *
 * Only what is shown goes through here. The write rules — a second review's
 * 409, a save's "every chosen deviation judged" — read the verdict as stored.
 */

/** A deviation as stored, with whether the review that judged it is saved. */
export type RecordedDeviation = Deviation & { verdict_saved: boolean };

/**
 * The verdict as seen from `inReview` (a review's id), or from outside every
 * review (null): as stored when its review is saved or is the one looking,
 * otherwise none.
 */
export function seenVerdict(
  d: RecordedDeviation,
  inReview: string | null,
): Deviation {
  const { verdict_saved, ...deviation } = d;
  const visible =
    deviation.verdict_review_id !== null &&
    (verdict_saved || deviation.verdict_review_id === inReview);
  return visible
    ? deviation
    : { ...deviation, verdict: null, verdict_review_id: null };
}
