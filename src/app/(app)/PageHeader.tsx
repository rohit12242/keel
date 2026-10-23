import { AccountMenu } from "./AccountMenu";
import styles from "./shell.module.css";

/**
 * A page's header (01-shell.md): the eyebrow and the title, the page's
 * primary action on the right, and on phone a smaller form of that action
 * beside the avatar that opens the account menu. Keyboard hints arrive with
 * the shortcuts.
 */
export function PageHeader({
  eyebrow,
  title,
  action,
  phoneAction,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  phoneAction?: React.ReactNode;
}) {
  return (
    <header className={styles.head}>
      <div className={styles.headText}>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <h1 className={styles.title}>{title}</h1>
      </div>
      {action ? <div className={styles.desktopOnly}>{action}</div> : null}
      <div className={styles.phoneOnly}>
        {phoneAction}
        <AccountMenu />
      </div>
    </header>
  );
}
