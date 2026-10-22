import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signedInUser } from "@/modules/session/service";
import type { SessionUser } from "@/shared/contract";

/**
 * Who is signed in, from the cookie alone — no database read (ADR-002) — or
 * off to Sign in. Every signed-in page calls it, not only the layout: a
 * layout is not rendered again on a client-side navigation, so a session
 * that ended while the page was open would otherwise go unnoticed.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = signedInUser((await headers()).get("cookie"), new Date());
  if (!user) redirect("/sign-in");
  return user;
}
