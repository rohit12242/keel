"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useBrowserDay } from "@/app/browserDay";

/**
 * Today without a date: the browser says which day it is (NFR-12), and the
 * URL gains `?date=`, keeping whatever else it carried (`reset=done`). It
 * replaces, so Back does not return to the dateless page, and it renders
 * only where the date is missing, so it cannot run twice.
 */
export function BrowserDay() {
  const day = useBrowserDay();
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    if (!day) return;
    const next = new URLSearchParams(params);
    next.set("date", day.today);
    router.replace(`/?${next}`);
  }, [day, params, router]);
  return null;
}
