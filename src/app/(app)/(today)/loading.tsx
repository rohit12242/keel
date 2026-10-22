import { PageHeader } from "../PageHeader";
import styles from "./today.module.css";

/** Loading state: shown, inside the frame, while Today's render is in flight. */
export default function Loading() {
  return (
    <>
      <PageHeader title="Today" />
      <p className={styles.empty} aria-busy="true">
        Loading your day…
      </p>
    </>
  );
}
