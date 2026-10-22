"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMe } from "./ShellProvider";
import { SignOut } from "./SignOut";
import { ThemeSwitch } from "./ThemeSwitch";
import styles from "./shell.module.css";

/**
 * The phone header's avatar and its menu (01-shell.md): "Signed in as
 * {name}", the theme and Sign out. It stays open while the theme changes,
 * so the change is seen. A disclosure, not role="menu": it promises no arrow
 * keys. Esc closes it and puts focus back on the avatar; a press outside
 * closes it.
 */
export function AccountMenu() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const avatar = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      avatar.current?.focus();
    }
    function onPointerDown(e: PointerEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={wrap} className={styles.account}>
      <button
        ref={avatar}
        type="button"
        className={styles.avatarButton}
        aria-label="Account"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        {me.initial}
      </button>
      <div id={menuId} className={styles.menu} hidden={!open}>
        <span className={styles.menuLabel}>Signed in as {me.name}</span>
        <ThemeSwitch inMenu />
        <SignOut label="Sign out" className={styles.menuItem} />
      </div>
    </div>
  );
}
