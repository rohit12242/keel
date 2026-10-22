"use client";

import { useId, useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/app/icons";
import {
  themeCookie,
  themeFrom,
  type Theme,
} from "@/modules/shell/domain/shell";
import { useSavedTheme } from "./ShellProvider";
import styles from "./shell.module.css";

const DARK = "(prefers-color-scheme: dark)";

// One store for every switch on the page, so the sidebar's and the menu's
// always agree.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  const device = window.matchMedia(DARK);
  listeners.add(onChange);
  device.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    device.removeEventListener("change", onChange);
  };
}

/** The theme on screen: the choice on <html>, else the device's. */
function shown(): Theme {
  return (
    themeFrom(document.documentElement.dataset.theme) ??
    (window.matchMedia(DARK).matches ? "dark" : "light")
  );
}

/** The choice holds in this browser, on every page, sign-in included. */
function choose(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = themeCookie(theme, window.location.protocol === "https:");
  listeners.forEach((l) => l());
}

/**
 * Light / Dark (01-shell.md), no System option. Before any choice the
 * server can't know the device's preference, so neither button is pressed
 * until the page is live; the colours themselves are already right.
 */
export function ThemeSwitch({ inMenu = false }: { inMenu?: boolean }) {
  const savedTheme = useSavedTheme();
  const current = useSyncExternalStore(subscribe, shown, () => savedTheme);
  const labelId = useId();

  return (
    <div className={inMenu ? styles.menuTheme : styles.sideTheme}>
      <span id={labelId} className={styles.themeLabel}>
        Theme
      </span>
      <div className={styles.seg} role="group" aria-labelledby={labelId}>
        <button
          type="button"
          className={styles.segButton}
          aria-pressed={current === "light"}
          onClick={() => choose("light")}
        >
          <SunIcon />
          Light
        </button>
        <button
          type="button"
          className={styles.segButton}
          aria-pressed={current === "dark"}
          onClick={() => choose("dark")}
        >
          <MoonIcon />
          Dark
        </button>
      </div>
    </div>
  );
}
