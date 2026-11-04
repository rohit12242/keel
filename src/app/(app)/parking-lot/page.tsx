import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { filterOf, inFilter } from "@/modules/parking/domain/parkingView";
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
 * The Parking lot (07-parking-lot.md): every idea, newest caught first,
 * filtered by `?status=`. On desktop the filter's newest is open beside
 * the list.
 */
export default async function ParkingLotPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const filter = filterOf((await searchParams).status);
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
      filter={filter}
      selected={inFilter(read.ideas, filter)[0]?.id ?? null}
      today={today}
      zone={zone}
    />
  );
}
