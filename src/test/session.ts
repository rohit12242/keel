import { getConfig } from "@/config/env";
import { sessionCookie } from "@/shared/session";

/**
 * The Cookie header a browser signed in as `userId` would send — signed with
 * the same secret and code the app checks it with. Integration tests only.
 */
export function cookieFor(
  userId: string,
  now = new Date(),
  email = `itest-${userId}@keel.test`,
  name: string | null = "Itest",
): string {
  return sessionCookie(
    { id: userId, email, name },
    now,
    getConfig().sessionSecret,
  ).split(";")[0];
}
