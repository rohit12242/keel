import type { Pill } from "@/modules/parking/domain/parkingView";
import styles from "./parkingLot.module.css";

/**
 * An idea's state pill (07-parking-lot.md): the words always, its colour
 * from tokens.md. `info` is what follows the words: in a row the ⓘ is a
 * mark only; in the detail it is the button that shows the rule.
 */
export function IdeaPill({
  pill,
  text,
  info,
}: {
  pill: Pill;
  text: string;
  info?: React.ReactNode;
}) {
  return (
    <span className={`${styles.pill} ${styles[pill.state]}`}>
      {text}
      {pill.info ? info : null}
    </span>
  );
}
