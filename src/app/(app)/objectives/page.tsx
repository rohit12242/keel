import type { Metadata } from "next";
import { PageHeader } from "../PageHeader";
import { requireUser } from "../requireUser";
import styles from "../shell.module.css";

export const metadata: Metadata = { title: "Objectives · Keel" };

/** The frame's place for Objectives. The screen itself is its own intent. */
export default async function ObjectivesPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Objectives" />
      <p className={styles.notBuilt}>This screen isn&rsquo;t built yet.</p>
    </>
  );
}
