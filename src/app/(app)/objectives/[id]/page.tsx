import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Objective } from "@/shared/contract";
import { requireUser } from "../../requireUser";
import { readApi } from "../../readApi";
import { ObjectiveDetail } from "../ObjectiveDetail";
import { ObjectivesHeader } from "../ObjectivesHeader";
import { todayFor } from "../today";
import styles from "../objectives.module.css";

export const metadata: Metadata = { title: "Objectives · Keel" };

// Server-rendered per request (D-04), from the real endpoint.
export const dynamic = "force-dynamic";

/** One objective (04-objectives.md, *Detail*), at its own address. */
export default async function ObjectivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const today = await todayFor(user);
  const read = await readApi<Objective>(
    `/objectives/${encodeURIComponent(id)}`,
  );

  if (read === "signed_out") redirect("/sign-in");
  // Unknown, or someone else's (NFR-10): back to the list.
  if (read === "not_found") redirect("/objectives");

  return (
    <>
      <ObjectivesHeader />
      {read === "unreachable" ? (
        <div className={styles.error} role="alert">
          <strong>Couldn&rsquo;t reach your objectives.</strong> Nothing has
          been lost — try again in a moment.
        </div>
      ) : (
        <ObjectiveDetail
          key={read.value.id}
          objective={read.value}
          today={today}
          backHref="/objectives"
        />
      )}
    </>
  );
}
