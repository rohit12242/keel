import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Objective, ObjectiveSummary } from "@/shared/contract";
import {
  FILTERS,
  inFilter,
  type Filter,
} from "@/modules/objectives/domain/objectiveView";
import { readApi } from "../readApi";
import { requireUser } from "../requireUser";
import { ObjectivesHeader } from "./ObjectivesHeader";
import { Screen, Unreachable } from "./Screen";
import { todayFor } from "./today";

export const metadata: Metadata = { title: "Objectives · Keel" };

// Server-rendered per request (D-04), from the real endpoints.
export const dynamic = "force-dynamic";

/**
 * Objectives (04-objectives.md): the list, filtered by `?status=`, Active
 * by default. On desktop the filter's first objective is open beside it.
 */
export default async function ObjectivesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { status } = await searchParams;
  const filter: Filter = FILTERS.find((f) => f.id === status)?.id ?? "active";
  const today = await todayFor(user);
  // One read gives every filter its count.
  const list = await readApi<{ objectives: ObjectiveSummary[] }>(
    "/objectives?status=all",
  );
  if (list === "signed_out") redirect("/sign-in");
  if (typeof list !== "object") {
    return (
      <>
        <ObjectivesHeader />
        <Unreachable />
      </>
    );
  }

  const objectives = list.value.objectives;
  const first = inFilter(objectives, filter)[0];
  const detail = first
    ? await readApi<Objective>(`/objectives/${first.id}`)
    : null;
  if (detail === "signed_out") redirect("/sign-in");

  return (
    <Screen
      show="list"
      objectives={objectives}
      filter={filter}
      detail={detail}
      today={today}
    />
  );
}
