"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./(app)/(today)/today.module.css";

/**
 * Sign out: Keel clears its cookie, and the browser goes to Sign in. There is
 * nothing else to drop — no Cognito token outlived the sign-in (ADR-002).
 * Interim, until the app shell's account menu (01-shell.md).
 */
export function SignOutButton() {
  const router = useRouter();
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
        router.push("/sign-in");
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
        className={styles.signOut}
        onClick={signOut}
        disabled={busy}
        aria-busy={busy || undefined}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {failed ? (
        <span role="alert" className={styles.signOutError}>
          Couldn&rsquo;t sign out. Try again.
        </span>
      ) : null}
    </>
  );
}
