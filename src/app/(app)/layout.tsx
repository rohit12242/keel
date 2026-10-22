import { KeelMark } from "@/app/icons";
import { cookies } from "next/headers";
import {
  initialOf,
  THEME_COOKIE,
  themeFrom,
} from "@/modules/shell/domain/shell";
import { Nav } from "./Nav";
import { requireUser } from "./requireUser";
import { ShellProvider } from "./ShellProvider";
import { SignOut } from "./SignOut";
import { ThemeSwitch } from "./ThemeSwitch";
import styles from "./shell.module.css";

// The session is read per request, never at build time.
export const dynamic = "force-dynamic";

/**
 * The frame around every signed-in page (01-shell.md): the sidebar above
 * 860 px, the bottom tab bar at 860 px and below. Without a session, Sign in.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const me = { name: user.name, initial: initialOf(user.name) };
  const savedTheme = themeFrom((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <ShellProvider me={me} savedTheme={savedTheme}>
      <div className={styles.app}>
        <aside className={styles.side}>
          <div className={styles.brand}>
            <KeelMark />
            <span className={styles.wordmark}>Keel</span>
          </div>
          <Nav variant="side" />
          <div className={styles.sideFoot}>
            <ThemeSwitch />
            <div className={styles.user}>
              <span className={styles.avatar} aria-hidden="true">
                {me.initial}
              </span>
              <span className={styles.userText}>
                <span className={styles.userName}>{me.name}</span>
                <SignOut label="Log out" className={styles.logOut} />
              </span>
            </div>
          </div>
        </aside>
        <main className={styles.main}>{children}</main>
        <Nav variant="tabs" />
      </div>
    </ShellProvider>
  );
}
