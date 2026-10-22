"use client";

import { PageHeader } from "../PageHeader";
import styles from "./today.module.css";

/**
 * Error boundary state: catches an unexpected render failure. The endpoint's
 * own failure (e.g. the database down) is handled inline in the page; this is
 * the safety net for anything else.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <PageHeader title="Today" />
      <div className={styles.error} role="alert">
        <strong>Something went wrong.</strong> The day couldn&rsquo;t be shown.{" "}
        <button type="button" onClick={reset} className={styles.retry}>
          Try again
        </button>
      </div>
    </>
  );
}
