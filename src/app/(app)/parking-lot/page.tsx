import type { Metadata } from "next";
import { PageHeader } from "../PageHeader";
import { requireUser } from "../requireUser";
import styles from "../shell.module.css";

export const metadata: Metadata = { title: "Parking lot · Keel" };

/** The frame's place for the Parking lot. The screen itself is its own intent. */
export default async function ParkingLotPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Parking lot" />
      <p className={styles.notBuilt}>This screen isn&rsquo;t built yet.</p>
    </>
  );
}
