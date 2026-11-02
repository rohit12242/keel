import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  FILTERS,
  inFilter,
  type KindFilter,
} from "@/modules/deviations/domain/deviationView";
import { requireUser } from "../requireUser";
import { todayFor } from "../objectives/today";
import { readWeek } from "./read";
import { Screen, Unreachable } from "./Screen";

export const metadata: Metadata = { title: "Deviations · Keel" };

// Server-rendered per request (D-04), from the real endpoints.
export const dynamic = "force-dynamic";

/**
 * Deviations (06-deviations.md): this week only, Monday to Sunday in the
 * user's zone, filtered by `?kind=`. On desktop the filter's newest is open
 * beside the list.
 */
export default async function DeviationsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const user = await requireUser();
  const { kind } = await searchParams;
  const filter: KindFilter = FILTERS.find((f) => f.id === kind)?.id ?? "all";
  const today = await todayFor(user);
  const read = await readWeek(today);
  if (read === "signed_out") redirect("/sign-in");
  if (read === "unreachable") return <Unreachable />;

  return (
    <Screen
      show="list"
      read={read}
      filter={filter}
      selected={inFilter(read.list.deviations, filter)[0]?.id ?? null}
      today={today}
    />
  );
}
