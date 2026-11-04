import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { zoneOf } from "@/modules/session/service";
import { localDayOf } from "@/shared/time/localDay";
import { requireUser } from "../requireUser";
import { readLot } from "./read";
import { Unreachable } from "./ParkingHeader";
import { Screen } from "./Screen";

export const metadata: Metadata = { title: "Parking lot · Keel" };

// Server-rendered per request (D-04), from the real endpoints.
export const dynamic = "force-dynamic";

/**
 * The Parking lot (07-parking-lot.md): every idea, newest caught first, no
 * filter. On desktop the newest is open beside the list.
 */
export default async function ParkingLotPage() {
  const user = await requireUser();
  // Today in the user's zone, as the API counts it (I-07).
  const zone = await zoneOf(user.id);
  if (!zone) redirect("/sign-in");
  const today = localDayOf(new Date(), zone);
  const read = await readLot();
  if (read === "signed_out") redirect("/sign-in");
  if (read === "unreachable") return <Unreachable />;

  return (
    <Screen
      show="list"
      ideas={read.ideas}
      objectives={read.objectives}
      selected={read.ideas[0]?.id ?? null}
      today={today}
      zone={zone}
    />
  );
}
