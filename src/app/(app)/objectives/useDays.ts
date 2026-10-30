"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { EffortEntry, ScheduleGrid } from "@/shared/contract";

export type Days =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; grid: ScheduleGrid["days"]; entries: EffortEntry[] };

/**
 * An objective's days over a range: the schedule grid's states and figures,
 * and the entries, in two reads (never one per day, NFR-03). Read when the
 * Effort tab or a week opens, not with the page. `range` null reads nothing.
 */
export function useDays(
  objectiveId: string,
  range: { from: string; to: string } | null,
): Days {
  const router = useRouter();
  const [days, setDays] = useState<Days>({ state: "loading" });
  const from = range?.from;
  const to = range?.to;

  useEffect(() => {
    if (!from || !to) return;
    let live = true;
    const q = `from=${from}&to=${to}`;
    const base = `/v1/objectives/${objectiveId}`;
    const read = (path: string) =>
      fetch(`${base}/${path}?${q}`, { credentials: "same-origin" });
    Promise.all([read("schedule"), read("effort-entries")])
      .then(async ([grid, entries]) => {
        if (grid.status === 401 || entries.status === 401) {
          router.push("/sign-in");
          return;
        }
        if (!grid.ok || !entries.ok) throw new Error("unreadable");
        const g = (await grid.json()) as ScheduleGrid;
        const e = (await entries.json()) as { entries: EffortEntry[] };
        if (live) setDays({ state: "ready", grid: g.days, entries: e.entries });
      })
      .catch(() => {
        if (live) setDays({ state: "failed" });
      });
    return () => {
      live = false;
    };
  }, [objectiveId, from, to, router]);

  return days;
}

/** When a read fails, the page says so rather than showing an empty day. */
export const READ_FAILED = "Couldn't load these days. Try again.";
