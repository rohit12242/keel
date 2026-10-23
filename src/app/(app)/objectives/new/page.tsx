import type { Metadata } from "next";
import { PageHeader } from "../../PageHeader";
import { requireUser } from "../../requireUser";
import { BackToObjectives, NewObjectiveForm } from "./NewObjectiveForm";

export const metadata: Metadata = { title: "New objective · Keel" };

/** The New objective page (04-objectives.md), a full page inside the frame. */
export default async function NewObjectivePage() {
  await requireUser();
  return (
    <>
      <BackToObjectives />
      <PageHeader title="New objective" />
      <NewObjectiveForm />
    </>
  );
}
