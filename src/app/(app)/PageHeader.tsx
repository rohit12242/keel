import styles from "./shell.module.css";

/**
 * A page's header (01-shell.md): the eyebrow and the title. The primary
 * action and its keyboard hint arrive with the screen that has one.
 */
export function PageHeader({
  eyebrow,
  title,
}: {
  eyebrow?: string;
  title: string;
}) {
  return (
    <header className={styles.head}>
      <div className={styles.headText}>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <h1 className={styles.title}>{title}</h1>
      </div>
    </header>
  );
}
