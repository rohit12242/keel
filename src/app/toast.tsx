"use client";

import { createContext, useContext, useEffect, useState } from "react";
import styles from "./toast.module.css";

/**
 * The one toast (01-shell.md): bottom centre, 2.8 s, above the tab bar on
 * phone, for confirmations only. A layout holds the provider, so a toast
 * shown just before a client navigation inside it is still seen after.
 */

const SHOWN_MS = 2800;

const ToastContext = createContext<(text: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // The count makes the same words shown twice a new toast, with a new timer.
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), SHOWN_MS);
    return () => clearTimeout(t);
  }, [toast]);
  const show = (text: string) =>
    setToast((prev) => ({ text, n: (prev?.n ?? 0) + 1 }));

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite">
        {toast ? (
          <div key={toast.n} className={styles.toast}>
            {toast.text}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

/** Show a confirmation, read out as it appears. */
export const useToast = (): { show: (text: string) => void } => ({
  show: useContext(ToastContext),
});
