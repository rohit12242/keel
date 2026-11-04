import { ParkingIcon } from "@/app/icons";
import { EMPTY } from "@/modules/parking/domain/parkingView";
import styles from "./parkingLot.module.css";

/** No ideas yet (07-parking-lot.md, *Empty*): what parking is, in three steps. */
export function EmptyLot({ action }: { action?: React.ReactNode }) {
  return (
    <section className={styles.emptyCard} aria-labelledby="no-ideas">
      <span className={styles.emptyIcon} aria-hidden="true">
        <ParkingIcon />
      </span>
      <h2 id="no-ideas">{EMPTY.title}</h2>
      <p>{EMPTY.body}</p>
      <ol className={styles.steps}>
        {EMPTY.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {action}
    </section>
  );
}
