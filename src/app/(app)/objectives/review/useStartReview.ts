"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Review } from "@/shared/contract";

/**
 * **Start review** (05-reviews.md): `POST /objectives/{id}/reviews` with no
 * body, so the server opens the oldest due window (G-05) — the page never
 * names one. Idempotent on the server; sent once here all the same.
 */
export function useStartReview(objectiveId: string) {
  const router = useRouter();
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setFailed(false);
    let res: Response | null = null;
    try {
      res = await fetch(`/v1/objectives/${objectiveId}/reviews`, {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // The same as any other failure.
    }
    if (res && (res.status === 200 || res.status === 201)) {
      const review = (await res.json().catch(() => null)) as Review | null;
      if (review) {
        // The page is left, so `sending` stays set.
        router.push(`/objectives/${objectiveId}/reviews/${review.id}`);
        return;
      }
    }
    if (res?.status === 401) {
      router.push("/sign-in");
      return;
    }
    sending.current = false;
    setBusy(false);
    setFailed(true);
  }

  return { start, busy, failed };
}
