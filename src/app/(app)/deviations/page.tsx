import type { Metadata } from "next";
import { PageHeader } from "../PageHeader";
import { requireUser } from "../requireUser";
import styles from "../shell.module.css";

export const metadata: Metadata = { title: "Deviations · Keel" };

/** The frame's place for Deviations. The screen itself is its own intent. */
export default async function DeviationsPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Deviations" />
      <p className={styles.notBuilt}>This screen isn&rsquo;t built yet.</p>
    </>
  );
}
