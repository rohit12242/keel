import {
  KIND_LABEL,
  type Kind,
} from "@/modules/deviations/domain/deviationView";
import styles from "./deviations.module.css";

/** Chosen in caution, Drifted in the deviation colour; the word always shows. */
export function KindPill({ kind }: { kind: Kind }) {
  return (
    <span className={`${styles.pill} ${styles[kind]}`}>{KIND_LABEL[kind]}</span>
  );
}
