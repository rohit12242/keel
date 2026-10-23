"use client";

import { useSyncExternalStore } from "react";
import { localDayOf } from "@/shared/time/localDay";

/**
 * The browser's own day and zone (NFR-12): the day a person means by
 * "today" is on their calendar, not the server's. Null while rendering on
 * the server, which has no browser to ask.
 */
export type BrowserDay = { today: string; tz: string };

const noChanges = () => () => {};
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const onServer = () => null;

export function useBrowserDay(): BrowserDay | null {
  const tz = useSyncExternalStore(noChanges, zone, onServer);
  const today = useSyncExternalStore(
    noChanges,
    () => localDayOf(new Date(), zone()),
    onServer,
  );
  return tz && today ? { today, tz } : null;
}
