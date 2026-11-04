"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./parkingLot.module.css";

/**
 * The ⓘ on a locked pill (07-parking-lot.md): a button that shows the lock
 * rule as a tooltip. Esc or a click elsewhere closes it.
 */
export function LockInfo({ rule }: { rule: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className={styles.info} ref={box}>
      <button
        ref={button}
        type="button"
        className={styles.infoButton}
        aria-label="How the lock works"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        ⓘ
      </button>
      {open ? (
        <span className={styles.tip} role="tooltip" id={id}>
          {rule}
        </span>
      ) : null}
    </span>
  );
}
