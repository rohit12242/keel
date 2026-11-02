import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Objective, ObjectiveSummary } from "@/shared/contract";
import { readApi } from "../../readApi";
import { requireUser } from "../../requireUser";
import { ObjectivesHeader } from "../ObjectivesHeader";
import { tabOf } from "../tabs";
import { readReviews } from "../reviews";
import { Screen, Unreachable } from "../Screen";
import { readDeviations } from "../deviations";
import { dayAndZone } from "../today";

export const metadata: Metadata = { title: "Objectives · Keel" };

// Server-rendered per request (D-04), from the real endpoints.
export const dynamic = "force-dynamic";

/**
 * One objective at its own address (04-objectives.md, *Detail*), selected
 * in the list under its own status. `?created=1` flashes its row once,
 * after New objective. `?tab=reviews` opens that tab, after a review is
 * saved or discarded.
 */
export default async function ObjectivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; tab?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { created, tab } = await searchParams;
  const { today, tz } = await dayAndZone(user);
  const [detail, list, reviews] = await Promise.all([
    readApi<Objective>(`/objectives/${encodeURIComponent(id)}`),
    readApi<{ objectives: ObjectiveSummary[] }>("/objectives?status=all"),
    readReviews(id),
  ]);

  if (detail === "signed_out" || list === "signed_out") redirect("/sign-in");
  if (reviews === "signed_out") redirect("/sign-in");
  // Unknown, or someone else's (NFR-10): back to the list.
  if (detail === "not_found") redirect("/objectives");
  if (typeof detail !== "object" || typeof list !== "object") {
    return (
      <>
        <ObjectivesHeader />
        <Unreachable />
      </>
    );
  }

  // After the objective's read: the range is its plan.
  const deviations = await readDeviations(detail.value);
  if (deviations === "signed_out") redirect("/sign-in");

  return (
    <Screen
      show="detail"
      objectives={list.value.objectives}
      filter={detail.value.status}
      detail={detail}
      deviations={deviations}
      reviews={reviews}
      flash={created === "1"}
      today={today}
      tz={tz}
      tab={tabOf(tab)}
    />
  );
}
