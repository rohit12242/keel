import { describe, expect, it } from "vitest";
import { isShortcut, type KeyPress } from "./shortcuts";

const press = (over: Partial<KeyPress> = {}): KeyPress => ({
  key: "l",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  typing: false,
  inWidget: false,
  dialogOpen: false,
  ...over,
});

describe("isShortcut (01-shell.md)", () => {
  it("is a plain l or L", () => {
    expect(isShortcut(press(), "l")).toBe(true);
    expect(isShortcut(press({ key: "L" }), "l")).toBe(true);
    expect(isShortcut(press({ key: "d" }), "l")).toBe(false);
  });

  it("never with ⌘, Ctrl or Alt — ⌘L is the browser's", () => {
    for (const mod of ["metaKey", "ctrlKey", "altKey"] as const) {
      expect(isShortcut(press({ [mod]: true }), "l")).toBe(false);
    }
  });

  it("never while typing, inside a widget with its own keys, or with a dialog open", () => {
    expect(isShortcut(press({ typing: true }), "l")).toBe(false);
    expect(isShortcut(press({ inWidget: true }), "l")).toBe(false);
    expect(isShortcut(press({ dialogOpen: true }), "l")).toBe(false);
  });
});
