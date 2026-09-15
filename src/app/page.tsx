import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Keel</h1>
      <p className={styles.lede}>
        Walking skeleton. No product features yet — this page exists only to
        prove the scaffold, the styling tokens and the toolchain are wired up.
      </p>
      <p className={styles.note}>
        Structure follows ADR-001: rules live in{" "}
        <code>src/modules/*/domain</code>, which imports nothing that speaks
        HTTP or SQL. Enforced by lint here, in CI at W3-10.
      </p>
    </div>
  );
}
