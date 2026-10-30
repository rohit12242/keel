"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./dialog.module.css";

/**
 * The app's dialog (01-shell.md, *Dialogs*): a native modal `<dialog>`, so
 * the scrim, `Esc`, the inert page behind and focus going back to the
 * button that opened it come from the browser. A centred card on desktop, a
 * bottom sheet on phone. It draws the frame — the title and the close
 * button — and the content brings its own form, laid out with `dialogParts`
 * (a body, then a footer with the keyboard hint or a danger action on the
 * left and the buttons on the right). Focus goes to the content's element
 * marked `data-autofocus`. `busy` holds it open while a request is in
 * flight. `wide` is the week dialogs' 640 px.
 */
export function Dialog({
  open,
  title,
  onClose,
  busy = false,
  wide = false,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The content names its first field; otherwise the browser picks.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${wide ? styles.wide : ""}`}
      aria-labelledby={titleId}
      // Esc: the dialog closes through the page's state, never on its own.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      // But the browser may close it anyway: Chrome lets a page refuse Esc
      // only once in a row. Then the page's state follows, or it stays "open"
      // and the dialog can't be opened again.
      onClose={() => {
        if (open) onClose();
      }}
    >
      {open ? (
        <>
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
          {children}
        </>
      ) : null}
    </dialog>
  );
}

/** The parts a dialog's content is laid out with, and its buttons. */
export const dialogParts = {
  form: styles.form,
  shake: styles.shake,
  body: styles.body,
  foot: styles.foot,
  start: styles.start,
  actions: styles.actions,
  keys: styles.hint,
  primary: styles.primary,
  muted: styles.muted,
  danger: styles.danger,
};
