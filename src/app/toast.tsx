"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import styles from "./toast.module.css";

/**
 * The one toast (01-shell.md): bottom centre, above the tab bar on phone,
 * for confirmations only. 2.8 s, or 5 s when it carries an **Undo**; while
 * an Undo toast is hovered or holds focus it stays, so a keyboard or screen
 * reader user can reach the button. A layout holds the provider, so a toast
 * shown just before a client navigation inside it is still seen after.
 *
 * `onDone` is for an action held until its toast closes (G13): it runs once
 * when an Undo toast leaves without its Undo — its time is up, or another
 * toast replaces it — and never after Undo.
 */

const SHOWN_MS = 2800;
const UNDO_MS = 5000;

/** Reverses what the toast confirms, and says how that went. */
export type Undo = () => Promise<string>;

type Show = (
  text: string,
  options?: { undo?: Undo; onDone?: () => void },
) => void;

type Toast = {
  text: string;
  n: number;
  undo?: Undo;
  onDone?: () => void;
  /** Set once `onDone` has run, or Undo was used: it never runs again. */
  done?: boolean;
};

/** Run a toast's `onDone`, once. */
function finish(toast: Toast | null) {
  if (!toast?.onDone || toast.done) return;
  toast.done = true;
  toast.onDone();
}

const ToastContext = createContext<Show>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // The count makes the same words shown twice a new toast, with a new timer.
  const [toast, setToast] = useState<Toast | null>(null);
  const [held, setHeld] = useState(false);
  const [undoing, setUndoing] = useState(false);
  // The toast on screen, for `show` to finish before it replaces it.
  const current = useRef<Toast | null>(null);
  useEffect(() => {
    if (!toast || (toast.undo && held) || undoing) return;
    const t = setTimeout(
      () => {
        finish(toast);
        if (current.current === toast) current.current = null;
        setToast(null);
      },
      toast.undo ? UNDO_MS : SHOWN_MS,
    );
    return () => clearTimeout(t);
  }, [toast, held, undoing]);
  const show: Show = (text, options) => {
    finish(current.current);
    const next: Toast = {
      text,
      n: (current.current?.n ?? 0) + 1,
      undo: options?.undo,
      onDone: options?.onDone,
    };
    current.current = next;
    setHeld(false);
    setToast(next);
  };

  async function undo(run: Undo) {
    // Undo means the held action never runs.
    if (current.current) current.current.done = true;
    setUndoing(true);
    const text = await run();
    setUndoing(false);
    show(text);
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite">
        {toast ? (
          <div
            key={toast.n}
            className={styles.toast}
            onMouseEnter={() => setHeld(true)}
            onMouseLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
          >
            <span>{toast.text}</span>
            {toast.undo ? (
              <button
                type="button"
                className={styles.undo}
                disabled={undoing}
                aria-busy={undoing || undefined}
                onClick={() => toast.undo && undo(toast.undo)}
              >
                Undo
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

/** Show a confirmation, read out as it appears, with an optional Undo. */
export const useToast = (): { show: Show } => ({
  show: useContext(ToastContext),
});
