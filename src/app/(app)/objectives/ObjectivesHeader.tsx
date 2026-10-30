import Link from "next/link";
import { PlusIcon } from "@/app/icons";
import { PageHeader } from "../PageHeader";
import shell from "../shell.module.css";

/** The Objectives page's header, with **+ New objective** (04-objectives.md). */
export function ObjectivesHeader() {
  return (
    <PageHeader
      title="Objectives"
      action={
        <Link className={shell.primary} href="/objectives/new">
          <PlusIcon />
          New objective
        </Link>
      }
      phoneAction={
        <Link
          className={`${shell.primary} ${shell.primarySmall}`}
          href="/objectives/new"
          aria-label="New objective"
        >
          <PlusIcon />
          New
        </Link>
      }
    />
  );
}
