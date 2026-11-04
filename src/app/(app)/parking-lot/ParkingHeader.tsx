import { PageHeader } from "../PageHeader";
import styles from "./parkingLot.module.css";

/** The Parking lot header (07-parking-lot.md): the title, no counts line. */
export function ParkingHeader() {
  return <PageHeader title="Parking lot" />;
}

export function Unreachable() {
  return (
    <>
      <ParkingHeader />
      <div className={styles.error} role="alert">
        <strong>Couldn&rsquo;t reach your parking lot.</strong> Nothing has been
        lost — try again in a moment.
      </div>
    </>
  );
}
