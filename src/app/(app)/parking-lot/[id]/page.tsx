import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { filterOf } from "@/modules/parking/domain/parkingView";
import { zoneOf } from "@/modules/session/service";
import { localDayOf } from "@/shared/time/localDay";
import { requireUser } from "../../requireUser";
import { readLot } from "../read";
import { Unreachable } from "../ParkingHeader";
import { Screen } from "../Screen";

export const metadata: Metadata = { title: "Parking lot · Keel" };

// Server-rendered per request (D-04), from the real endpoints.
export const dynamic = "force-dynamic";

/**
 * One idea at its own address, selected in the list. There is no read of
 * one idea: it is found in the list. One unknown or someone else's (NFR-10)
 * goes to the list. `?parked=1` flashes its row once, after Park an idea.
 */
export default async function IdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ parked?: string; status?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { parked, status } = await searchParams;
  const zone = await zoneOf(user.id);
  if (!zone) redirect("/sign-in");
  const today = localDayOf(new Date(), zone);
  const read = await readLot();
  if (read === "signed_out") redirect("/sign-in");
  if (read === "unreachable") return <Unreachable />;
  const idea = read.ideas.find((i) => i.id === id);
  if (!idea) redirect("/parking-lot");
  // The filter it was opened from, as long as it shows it.
  const asked = filterOf(status);
  const filter = asked === "all" || asked === idea.verdict ? asked : "all";

  return (
    <Screen
      show="detail"
      ideas={read.ideas}
      objectives={read.objectives}
      filter={filter}
      selected={id}
      flash={parked === "1"}
      today={today}
      zone={zone}
    />
  );
}
