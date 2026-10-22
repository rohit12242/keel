# Plan — I-05 · The app shell

**Intent:** `intent.md` · **Spec:** `spec.md` · **Status:** ACCEPTED 2026-10-22 · **Written:** 2026-10-22

**Amended 2026-10-22, during the build, with Rohit's go-ahead.** Step 5's proof was
wrong. After signing out, Back showed the signed-in frame again: the browser restored
the old page from its back/forward cache without asking the server. Replacing the
history entry on sign out removes only that one entry, not the earlier ones from the
same page. A new step 7 makes a restored page ask the server again. The old step 7
becomes step 8.

## What the code has today, and what replaces each part

| Today | Where | Replaced by |
|---|---|---|
| Old tokens (`--color-*`, rem `--space-1…8`, `--radius`, `--font-serif`) | `src/app/tokens.css`, imported by `globals.css` | `keel-modern-tokens.css`, moved from `docs/design/` to `src/app/` and imported by `globals.css` |
| A scoped copy of the Keel Modern tokens on `[data-look="modern"]`, dark from the device only | `src/app/(auth)/modern.css` | Deleted. The sign-in layout's own surfaces (`--auth-bg`, `--hl`, `--input-bg`, `--chip-*`, `--ring-*`, `--band*`) move onto `.auth` in `auth.module.css` |
| Archivo, Spectral (400–600), Plex Mono (400, 500) in the root layout; Geist in the auth layout | `src/app/layout.tsx`, `src/app/(auth)/layout.tsx` | Geist, Plex Mono (400, 500, 600 — the auth code counter already asks for 600) and Spectral (600, wordmark only), all in the root layout. Archivo goes |
| Today at `/`, outside any frame; "Sign in to see your log" when signed out | `src/app/page.tsx`, `page.module.css`, `loading.tsx`, `error.tsx` | The same content in `src/app/(app)/(today)/`, inside the frame. Signed out → redirect to `/sign-in` |
| The stop-gap "Signed in as" and Sign out | `src/app/page.tsx`, `src/app/SignOutButton.tsx` | The sidebar's user block and the phone account menu, sharing one `SignOut` component |
| No theme choice | — | A `keel_theme` cookie (`light`/`dark`) read by the root layout; device preference until it exists |

**Two choices the spec left open, taken here:**

- **Where the one token file lives.** `docs/` is outside the Docker build context
  (CLAUDE.md, *Common mistakes*), so the app cannot import it from there. The file is
  **moved** to `src/app/keel-modern-tokens.css` and `docs/design/` points at it, so
  there is one copy, not a design copy and an app copy.
- **How the theme avoids a wrong first paint, with no script.** The same form as the
  prototype (`keel-modern-prototype.html:9–11`): light on `:root`, dark under
  `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and again
  under `:root[data-theme="dark"]`. With a cookie the server renders
  `<html data-theme="…">`; without one there is no attribute and the media query
  decides. The page is right on the first paint in both cases because CSS alone decides
  it. The cost: the dark values appear twice in the one file.

---

## Files that change

| Step | Files | What |
|---|---|---|
| 1 | `docs/intents/I-05-app-shell/plan.md` | This plan, `Status: ACCEPTED <date>`, committed alone |
| 2 | `docs/design/keel-modern-tokens.css` → `src/app/keel-modern-tokens.css` (`git mv`) | Adds the device-preference dark block (prototype form). Fonts read `next/font` variables: `--font-sans: var(--font-geist), …`, `--font-mono: var(--font-plex-mono), …`, `--font-brand: var(--font-spectral), …`. The variable names differ from the token names, so the class `next/font` puts on `<html>` can't collide with `:root` |
| 2 | `src/app/layout.tsx`, `src/app/globals.css`; **removed** `src/app/tokens.css` | The three fonts, loaded once. `globals.css` imports the new file; `body` takes `--bg`, `--text`, `--font-sans` |
| 2 | `src/app/(auth)/layout.tsx`, `src/app/(auth)/auth.module.css`; **removed** `src/app/(auth)/modern.css` | No Geist import, no `data-look`. The auth-only surfaces sit on `.auth`, with dark values under the same two selectors as the tokens (`:global(…) .auth`) |
| 2 | `src/app/page.module.css` | Old names → new, by the map in `tokens.md`. No layout change yet |
| 2 | `docs/design/README.md`, `docs/design/tokens.md`, `docs/intents/TRIAGE.md` | Point at the moved file; describe the device-preference block. Close "The Keel Modern tokens exist twice" |
| 3 | `src/modules/shell/domain/shell.ts` *(new, + `shell.test.ts`)* | Pure, no imports. `PLACES` (Today `/`, Objectives `/objectives`, Deviations `/deviations`, Parking lot `/parking-lot`); `currentPlace(pathname)` (exact for `/`, segment prefix for the rest); `initialOf(name)` (first character, upper-cased, `?` if empty); `themeFrom(value)` → `"light" \| "dark" \| null`; `themeCookie(theme, secure)` → the `document.cookie` string (`Path=/`, one year, `SameSite=Lax`, `Secure` on https) |
| 4 | `src/app/(app)/layout.tsx`, `shell.module.css`, `Nav.tsx`, `PageHeader.tsx`, `ShellProvider.tsx`, `requireUser.ts` *(all new)*; `src/app/icons.tsx` *(new)* | The frame. The layout reads the session (`signedInUser`, cookie only, no database) or redirects to `/sign-in`, and hands `{name, initial}` to a client context so the page header, `loading` and `error` all reach it. Sidebar above 860 px, tab bar at 860 px and below. `Nav` uses `usePathname` + `currentPlace` for `aria-current="page"`. `PageHeader`: eyebrow (optional) and `<h1>`. Icons and the Keel mark are inline SVG from the prototype; the auth layout uses the same mark |
| 4 | `src/app/page.tsx`, `page.module.css`, `loading.tsx`, `error.tsx` → `src/app/(app)/(today)/page.tsx`, `today.module.css`, `loading.tsx`, `error.tsx` | Today in the frame. Its title and date become the page header (eyebrow = the date it shows now). `signed_out` → `redirect("/sign-in")`. Loading and error are scoped to Today, not to the other three places |
| 4 | `src/app/(app)/objectives/page.tsx`, `deviations/page.tsx`, `parking-lot/page.tsx` *(new)* | Header and "This screen isn't built yet." Each calls `requireUser()` |
| 5 | `src/app/(app)/SignOut.tsx`, `AccountMenu.tsx` *(new)*; **removed** `src/app/SignOutButton.tsx`; `(today)/page.tsx`, `today.module.css` | Sidebar: avatar initial, name, **Log out**. Phone: the 44 px avatar button in the page header opens the menu ("Signed in as {name}", **Sign out**). Esc closes it and returns focus to the avatar; a pointer-down outside closes it. Failure → `role="alert"` "Couldn't sign out. Try again.", stay put. The stop-gap and its styles are deleted |
| 6 | `src/app/layout.tsx`, `src/app/(app)/ThemeSwitch.tsx` *(new)*, `AccountMenu.tsx`, `layout.tsx` | The root layout reads `keel_theme` through `themeFrom` and sets `data-theme` when it holds a choice. `ThemeSwitch`: a group of two `aria-pressed` buttons (Light ☀ / Dark ☾), in the sidebar foot and in the menu. Clicking sets `data-theme` on `<html>` and writes the cookie. Both switches read one store (`useSyncExternalStore`), so they agree |
| 7 | `src/app/(app)/FreshOnBack.tsx` *(new)*, `src/app/(app)/layout.tsx` | On `pageshow` with `persisted` (a page restored from the back/forward cache), reload, so the server decides again: Sign in without a session, the page as it is now with one |
| 8 | `docs/intents/TRIAGE.md` | Anything found on the way that this intent doesn't own |

## Order of work

1. **Accept the plan.** `plan.md` committed alone.
2. **One set of tokens and fonts.** The app still looks as it did except for the new
   palette and fonts; the sign-in screens look exactly as before. Theme follows the device.
3. **The shell's pure rules.** Nothing uses them yet.
4. **The frame and the four places.** Today moves into it; the stop-gap is still on
   Today for this one commit.
5. **Who is signed in, and signing out.** The stop-gap goes.
6. **The theme choice.**
7. **A page restored on Back asks the server again.** *(Added by the amendment.)*
8. **Proof** on localhost, then TRIAGE. After Rohit merges and the release deploys, the
   same browser proof on the deployed service.

No contract, migration, infra or dependency change in any step.

---

## Risks

*(Not interrogated: Rohit accepted the plan as drafted on 2026-10-22.)*

**What could break**

- **The sign-in screens' look (step 2).** Their tokens move from a scoped copy to
  `:root`, their font from their own layout to the root, and their dark mode gains a
  second trigger. A token missed in the move shows as a wrong colour, not an error.
- **An old name read after step 2.** `--space-4` meant 1 rem and now means 4 px;
  `--font-sans` and `--font-mono` change meaning too. A leftover reads the new value
  silently instead of failing.
- **The route move (step 4).** `/` goes into two route groups. A leftover
  `src/app/page.tsx` beside `(app)/(today)/page.tsx` is a build error, which is the
  safe kind.
- **A stale frame on client navigation.** A layout does not re-render on a soft
  navigation, so the layout's redirect alone would not catch a session that ended while
  the page was open. Each page therefore calls `requireUser()` itself.
- **Every page becomes dynamic.** The root layout reads a cookie. The signed-in pages
  and the sign-in screens already are; `_not-found` becomes dynamic too. `/docs` and
  `/v1/*` are route handlers and are not affected.
- **The switch's pressed state without a cookie.** The server doesn't know the device
  preference, so neither button is pressed in the server HTML. It is set on
  hydration. The theme itself is right from the first paint; only the pressed state
  shows late.

**The riskiest step: 2.** It is the only step that changes screens which are already
live and correct, and the failure is visual and silent. Mitigations: a grep for every
old name must return nothing (below), and the five sign-in screens are screenshotted
on `main` and on the branch, in light and dark, and compared.

**What was not chosen**

- **An inline script that sets the theme before paint** (the `next-themes` approach).
  CSS alone is enough, it needs no `suppressHydrationWarning`, and it works with
  JavaScript off.
- **The `Sec-CH-Prefers-Color-Scheme` client hint**, so the server knows the device
  preference. Chromium only, and missing on the first request.
- **A route or server action to store the theme.** It would be an endpoint outside the
  contract. The cookie is written in the browser, and nothing in it is personal.
- **Importing the token file from `docs/`** with a `.dockerignore` exception. It works,
  but the app's CSS would then live in the documentation folder.
- **Guarding pages with `proxy.ts` (middleware).** A per-page check is enough here and
  keeps the session check in one helper that the layout also uses.
- **`role="menu"` for the account menu.** That role promises arrow-key navigation. A
  disclosure (button + `aria-expanded` + `aria-controls`) matches what the menu does.
- **Component tests with jsdom / Testing Library.** That adds dev dependencies, and
  unit tests here run without a DOM (`vitest.config.ts`). The behaviour is proven in the
  browser instead.
- **The formatted date ("Thursday, 22 October") as Today's eyebrow**, the
  Deviations week range, primary actions, keyboard hints and a skip link. They come with
  the screens. Today's eyebrow keeps the date it shows now.
- **Sign out by `router.push`.** Sign out replaces the page with `/sign-in` in a full
  navigation, so the client router cache can't show the signed-in frame. On its own
  that was not enough. The back/forward cache still held the earlier pages, which is
  why step 7 was added.
- **`Cache-Control: no-store` to keep pages out of the back/forward cache.** Chrome
  is starting to cache `no-store` pages too, so it can't be relied on. Reloading on
  `pageshow` works whatever the browser decides to cache.

---

## Proof

| Step | Test | Why `main` stays deployable |
|---|---|---|
| 1 | — | Docs only |
| 2 | All seven checks. `grep -rnE -- '--color-\|--font-serif\|var\(--radius\)\|var\(--space-[1368]\)\|data-look\|--font-geist' src` returns nothing. Archivo appears nowhere in `src`. A **real image build** (`docker build`) once: the CSS now comes from `src/`, and `next/font` fetches at build time. Chrome screenshots of Sign in, Create account, Check your email and both Reset steps, light and dark (by device), on `main` and on the branch, side by side. Today renders with the new tokens | Every page renders; only the palette moved |
| 3 | `shell.test.ts`: `currentPlace` for `/`, `/objectives`, `/objectives/abc`, `/objectivesx` (none), `/sign-in` (none); `initialOf` for `"rohit"` → `R`, `" émile"` → `É`, `""` → `?`; `themeFrom` for `light`, `dark`, `system`, `undefined`; `themeCookie` with and without `Secure`. 100 % on the domain (ADR-007) | Unused code |
| 4 | Build. `curl -sI` on localhost, no cookie: `/`, `/objectives`, `/deviations`, `/parking-lot` → 307 to `/sign-in`; with a session cookie → 200. Chrome at 1280 px and 390 px: sidebar or tab bar, never both; `read_page` shows `aria-current="page"` on exactly the current item in each; tab-bar targets measure ≥ 44 px. Today's error state in the frame with Postgres stopped. Soft-navigation guard: end the session with `DELETE /v1/session` in the console, then click a nav item → Sign in | All four places work; the stop-gap still signs out |
| 5 | Chrome at 390 px: the avatar sets `aria-expanded`; Esc closes and focus is back on the avatar; a click outside closes. Sign out from the sidebar and from the menu → `/sign-in`. Failure: with `window.fetch` made to reject (javascript_tool), the alert shows and the URL stays. `grep -rn "Signed in as" src` finds only `AccountMenu.tsx` | Sign out moved, never missing |
| 6 | Unit tests above. `curl` with `Cookie: keel_theme=dark` → `<html … data-theme="dark"`; with none → no `data-theme`. Chrome: Dark in the sidebar → `data-theme="dark"` and the cookie is set; reload, then all four places and (after Sign out) the sign-in screens are dark; the menu stays open while the theme changes and both switches agree. Contrast, computed via javascript_tool, of nav labels, eyebrow, name, Log out and menu text in both themes: ≥ 4.5:1 | Additive |
| 7 | Sign out, then Back: the restored page reloads and lands on Sign in. While still signed in, Back to a restored page shows it as it is now | Additive |
| 8 | The whole journey recorded as a GIF: desktop and phone, move between the four places, switch the theme, sign out from each. After the release: the same on the deployed service | — |

Integration tests are not touched: no route handler, query or contract changes.
