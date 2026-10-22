"use client";

import { useState } from "react";
import styles from "./shell.module.css";

/**
 * Sign out: Keel clears its cookie, and the browser goes to Sign in. There is
 * nothing else to drop — no Cognito token outlived the sign-in (ADR-002). A
 * full navigation that replaces this page in the history, not a client one,
 * so Back can't show the signed-in frame from the router's cache. If it
 * fails, the person stays and is told.
 */
export function SignOut({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/v1/session", {
        method: "DELETE",
        credentials: "same-origin",
      });
      // 401: the session had already ended; either way the person is out.
      if (res.status === 204 || res.status === 401) {
        window.location.replace("/sign-in");
        return;
      }
    } catch {
      // fall through: say it did not work
    }
    setBusy(false);
    setFailed(true);
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={signOut}
        disabled={busy}
        aria-busy={busy || undefined}
      >
        {busy ? "Signing out…" : label}
      </button>
      {failed ? (
        <span role="alert" className={styles.signOutError}>
          Couldn&rsquo;t sign out. Try again.
        </span>
      ) : null}
    </>
  );
}
