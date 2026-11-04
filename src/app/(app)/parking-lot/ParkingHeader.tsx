import { PlusIcon } from "@/app/icons";
import { ParkIdeaButton } from "../ParkIdea";
import { KeyHint, PageHeader } from "../PageHeader";
import shell from "../shell.module.css";
import styles from "./parkingLot.module.css";

/**
 * The Parking lot header (07-parking-lot.md): the title, no counts line,
 * and **+ Park an idea** `P`, which opens the dialog of the
 * `ParkIdeaProvider` around the page. Without `parking`, the title alone.
 */
export function ParkingHeader({ parking = true }: { parking?: boolean }) {
  return (
    <PageHeader
      title="Parking lot"
      action={
        parking ? (
          <ParkIdeaButton className={shell.primary} aria-keyshortcuts="P">
            <PlusIcon />
            Park an idea
            <KeyHint k="P" />
          </ParkIdeaButton>
        ) : undefined
      }
      phoneAction={
        parking ? (
          <ParkIdeaButton className={`${shell.primary} ${shell.primarySmall}`}>
            <PlusIcon />
            Park an idea
          </ParkIdeaButton>
        ) : undefined
      }
    />
  );
}

export function Unreachable() {
  return (
    <>
      <ParkingHeader parking={false} />
      <div className={styles.error} role="alert">
        <strong>Couldn&rsquo;t reach your parking lot.</strong> Nothing has been
        lost — try again in a moment.
      </div>
    </>
  );
}
