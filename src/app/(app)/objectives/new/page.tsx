import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ParkedIdeaList } from "@/shared/contract";
import { approvedIdeas } from "@/modules/parking/domain/startFrom";
import { PageHeader } from "../../PageHeader";
import { readApi } from "../../readApi";
import { requireUser } from "../../requireUser";
import { BackToObjectives, NewObjectiveForm } from "./NewObjectiveForm";
import type { Approved } from "./StartFrom";

export const metadata: Metadata = { title: "New objective · Keel" };

// Server-rendered per request (D-04): the approved ideas are read each time.
export const dynamic = "force-dynamic";

/**
 * The New objective page (04-objectives.md), a full page inside the frame,
 * with "Start from" and the approved ideas it offers (I-16).
 */
export default async function NewObjectivePage() {
  await requireUser();
  const read = await readApi<ParkedIdeaList>("/parked-ideas");
  if (read === "signed_out") redirect("/sign-in");
  const ideas: Approved =
    typeof read === "object" ? approvedIdeas(read.value.ideas) : "unreachable";
  return (
    <>
      <BackToObjectives />
      <PageHeader title="New objective" />
      <NewObjectiveForm ideas={ideas} />
    </>
  );
}
