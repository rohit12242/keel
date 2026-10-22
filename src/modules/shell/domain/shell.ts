/**
 * The app shell's rules (`docs/design/screens/01-shell.md`), pure: the four
 * places and which one a path is in, the avatar's initial, and the theme a
 * cookie holds. The frame draws; this decides.
 */

export type PlaceId = "today" | "objectives" | "deviations" | "parking";

export type Place = { id: PlaceId; href: string; label: string };

/** The four places, in the order the sidebar and the tab bar show them. */
export const PLACES: readonly Place[] = [
  { id: "today", href: "/", label: "Today" },
  { id: "objectives", href: "/objectives", label: "Objectives" },
  { id: "deviations", href: "/deviations", label: "Deviations" },
  { id: "parking", href: "/parking-lot", label: "Parking lot" },
];

/**
 * The place a path belongs to: Today is `/` exactly; the others own their
 * path and anything under it (`/objectives/abc`), but not a longer name
 * (`/objectivesx`). Null outside the four.
 */
export function currentPlace(pathname: string): PlaceId | null {
  if (pathname === "/") return "today";
  const place = PLACES.find(
    (p) =>
      p.href !== "/" &&
      (pathname === p.href || pathname.startsWith(`${p.href}/`)),
  );
  return place ? place.id : null;
}

/** The avatar's letter: the name's first character, upper-cased. */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : "?";
}

export type Theme = "light" | "dark";

/** The cookie that keeps the person's choice, in that browser. */
export const THEME_COOKIE = "keel_theme";

/** A year: the choice holds until it is changed. */
const THEME_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** The choice a cookie value holds, or null when there is none. */
export function themeFrom(value: string | undefined): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

/** The `document.cookie` string that stores a choice. */
export function themeCookie(theme: Theme, secure: boolean): string {
  return [
    `${THEME_COOKIE}=${theme}`,
    "Path=/",
    `Max-Age=${THEME_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
