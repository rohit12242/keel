"use client";

/**
 * What one sign-in screen hands the next when the person moves between them
 * — the email already typed, and for an account whose email is not confirmed
 * yet, the password that confirming will sign in with. Held in this page's
 * memory only: never in the URL, never in browser storage. A page load clears
 * it; the screen that reads it clears it once it has rendered.
 */
export type Carried = { email?: string; password?: string; confirm?: boolean };

let carried: Carried = {};

export function carry(next: Carried): void {
  carried = next;
}

/** What was carried here. Pure, so a state initializer may call it twice. */
export const carriedHere = (): Carried => carried;

export function dropCarried(): void {
  carried = {};
}
