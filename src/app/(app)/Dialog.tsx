"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./dialog.module.css";

/**
 * The app's dialog (01-shell.md, *Dialogs*): a native modal `<dialog>`, so
 * the scrim, `Esc`, the inert page behind and focus going back to the
 * button that opened it come from the browser. A centred card on desktop, a
 * bottom sheet on phone. Its body is a form: Enter submits it.
 *
 * `busy` holds it open while a request is in flight; `shake` runs the
 * one shake a failed check gets, and `onShaken` clears it.
 */
export function Dialog({
  open,
  title,
  onClose,
  onSubmit,
  children,
  actions,
  start,
  busy = false,
  shake = false,
  onShaken,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
  /** The footer's buttons, on the right: Cancel, then the primary action. */
  actions: React.ReactNode;
  /** The footer's left side; the keyboard hint when there is nothing else. */
  start?: React.ReactNode;
  busy?: boolean;
  shake?: boolean;
  onShaken?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      // Esc, and closing by any other way the browser offers.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClose={() => open && onClose()}
    >
      {open ? (
        <form
          className={`${styles.form} ${shake ? styles.shake : ""}`}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(e);
          }}
          onAnimationEnd={() => onShaken?.()}
        >
          <div className={styles.head}>
            <h2 className={styles.title} id={titleId}>
              {title}
            </h2>
            <button
              type="button"
              className={styles.close}
              aria-label="Close"
              disabled={busy}
              onClick={onClose}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
          <div className={styles.body}>{children}</div>
          <div className={styles.foot}>
            <div className={styles.start}>
              {start ?? <span className={styles.hint}>esc to close</span>}
            </div>
            <div className={styles.actions}>{actions}</div>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}

/** The dialog's buttons: muted Cancel, the primary action, a danger action. */
export const dialogButton = {
  primary: styles.primary,
  muted: styles.muted,
  danger: styles.danger,
};
