"use client";

import { useEffect, useRef } from "react";

/**
 * Keyboard shortcuts (01-shell.md): one key, one action, on the page that
 * declares it. Ignored with ⌘, Ctrl or Alt (⌘L is the browser's), while
 * typing, inside a control that uses its own keys — a menu, a radio group,
 * tabs — and while a dialog is open.
 */

export type KeyPress = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  /** Focus is in an input, textarea, select or editable text. */
  typing: boolean;
  /** Focus is in a widget that uses its own keys. */
  inWidget: boolean;
  dialogOpen: boolean;
};

/** Whether a key press is the shortcut `key`, by the rules above. */
export function isShortcut(press: KeyPress, key: string): boolean {
  if (press.metaKey || press.ctrlKey || press.altKey) return false;
  if (press.typing || press.inWidget || press.dialogOpen) return false;
  return press.key.toLowerCase() === key.toLowerCase();
}

const WIDGETS =
  '[role="menu"], [role="radiogroup"], [role="tablist"], [role="listbox"]';

/** Run `handler` when `key` is pressed on this page. */
export function useShortcut(key: string, handler: () => void): void {
  // The latest handler, without re-subscribing on every render.
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target instanceof Element ? e.target : null;
      const press: KeyPress = {
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        typing:
          !!target &&
          (target.matches("input, textarea, select") ||
            (target as HTMLElement).isContentEditable),
        inWidget: !!target?.closest(WIDGETS),
        dialogOpen: document.querySelector("dialog[open]") !== null,
      };
      if (!isShortcut(press, key) || e.repeat) return;
      e.preventDefault();
      latest.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key]);
}
