import styles from "./page.module.css";

/** Loading state: shown while Today's server render is in flight. */
export default function Loading() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Today</h1>
      <p className={styles.empty} aria-busy="true">
        Loading your day…
      </p>
    </main>
  );
}
