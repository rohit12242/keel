import { KeelMark } from "@/app/icons";
import { initialOf } from "@/modules/shell/domain/shell";
import { Nav } from "./Nav";
import { requireUser } from "./requireUser";
import { ShellProvider } from "./ShellProvider";
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

  return (
    <ShellProvider me={me}>
      <div className={styles.app}>
        <aside className={styles.side}>
          <div className={styles.brand}>
            <KeelMark />
            <span className={styles.wordmark}>Keel</span>
          </div>
          <Nav variant="side" />
          <div className={styles.sideFoot} />
        </aside>
        <main className={styles.main}>{children}</main>
        <Nav variant="tabs" />
      </div>
    </ShellProvider>
  );
}
