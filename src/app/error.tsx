"use client";

import styles from "./page.module.css";

/**
 * Error boundary state: catches an unexpected render failure. The endpoint's
 * own failure (e.g. the database down) is handled inline in the page; this is
 * the safety net for anything else.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Today</h1>
      <div className={styles.error} role="alert">
        <strong>Something went wrong.</strong> The day couldn&rsquo;t be shown.{" "}
        <button type="button" onClick={reset} className={styles.retry}>
          Try again
        </button>
      </div>
    </main>
  );
}
