import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "@/app/icons";
import { PageHeader } from "../PageHeader";
import { requireUser } from "../requireUser";
import styles from "../shell.module.css";

export const metadata: Metadata = { title: "Objectives · Keel" };

/**
 * The frame's place for Objectives, with the way to a new one. The list and
 * detail are their own intent.
 */
export default async function ObjectivesPage() {
  await requireUser();
  return (
    <>
      <PageHeader
        title="Objectives"
        action={
          <Link className={styles.primary} href="/objectives/new">
            <PlusIcon />
            New objective
          </Link>
        }
        phoneAction={
          <Link
            className={`${styles.primary} ${styles.primarySmall}`}
            href="/objectives/new"
            aria-label="New objective"
          >
            <PlusIcon />
            New
          </Link>
        }
      />
      <p className={styles.notBuilt}>This screen isn&rsquo;t built yet.</p>
    </>
  );
}
