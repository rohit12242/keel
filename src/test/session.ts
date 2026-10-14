import { getConfig } from "@/config/env";
import { sessionCookie } from "@/shared/session";

/**
 * The Cookie header a browser signed in as `userId` would send — signed with
 * the same secret and code the app checks it with. Integration tests only.
 */
export function cookieFor(userId: string, now = new Date()): string {
  return sessionCookie(userId, now, getConfig().sessionSecret).split(";")[0];
}
