import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  FILTERS,
  type KindFilter,
} from "@/modules/deviations/domain/deviationView";
import { requireUser } from "../../requireUser";
import { zoneOf } from "@/modules/session/service";
import { localDayOf } from "@/shared/time/localDay";
import { readWeek } from "../read";
import { Screen, Unreachable } from "../Screen";

export const metadata: Metadata = { title: "Deviations · Keel" };

// Server-rendered per request (D-04), from the real endpoints.
export const dynamic = "force-dynamic";

/**
 * One deviation at its own address, selected in this week's list. There is
 * no read of one deviation: it is found in the week's. One from another
 * week, unknown or someone else's (NFR-10) goes to the list. `?recorded=1`
 * flashes its row once, after Log a deviation.
 */
export default async function DeviationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string; recorded?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { kind, recorded } = await searchParams;
  // Today in the user's zone, as the API counts it (I-07).
  const zone = await zoneOf(user.id);
  if (!zone) redirect("/sign-in");
  const today = localDayOf(new Date(), zone);
  const read = await readWeek(today);
  if (read === "signed_out") redirect("/sign-in");
  if (read === "unreachable") return <Unreachable />;

  const open = read.list.deviations.find((d) => d.id === id);
  if (!open) redirect("/deviations");
  // The filter it was opened from, as long as it shows it.
  const asked = FILTERS.find((f) => f.id === kind)?.id ?? "all";
  const filter: KindFilter =
    asked === "all" || asked === open.kind ? asked : "all";

  return (
    <Screen
      show="detail"
      read={read}
      filter={filter}
      selected={open.id}
      flash={recorded === "1"}
      today={today}
      zone={zone}
    />
  );
}
