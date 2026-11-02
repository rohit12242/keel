import type { ReviewList } from "@/shared/contract";
import { readApi, type Read } from "../readApi";

/**
 * The open objective's reviews: every one in period order, and what is due,
 * oldest first (G19). One read gives the tab its count, its cards and rows,
 * and the Overview its banner. Nothing about a window is worked out here.
 */
export const readReviews = (objectiveId: string): Promise<Read<ReviewList>> =>
  readApi<ReviewList>(`/objectives/${encodeURIComponent(objectiveId)}/reviews`);
