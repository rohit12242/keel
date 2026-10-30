import { redirect } from "next/navigation";
import { zoneOf } from "@/modules/session/service";
import { localDayOf } from "@/shared/time/localDay";
import type { SessionUser } from "@/shared/contract";

/**
 * The day the API calls today for this user: their zone's (I-07), the same
 * Today reads. Every "Day 14 of 30", "Starts" and "so far" is measured
 * against it, never against the browser's clock.
 */
export async function todayFor(user: SessionUser): Promise<string> {
  const zone = await zoneOf(user.id);
  if (!zone) redirect("/sign-in");
  return localDayOf(new Date(), zone);
}
