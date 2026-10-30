import type { EntryRow } from "@/modules/today/domain/todayView";
import type { Tag as TagValue } from "@/modules/objectives/domain/effortView";
import type { Tone } from "@/modules/objectives/domain/objectiveView";
import styles from "./objectives.module.css";

/** A day's tag and its entries: the Last day card's and the week dialog's. */

const TAG: Record<Tone, string> = {
  ok: styles.tagMet,
  risk: styles.tagShort,
  behind: styles.tagMiss,
  accent: styles.tagExtra,
  neutral: styles.tagOff,
};

export function Tag({ tag }: { tag: TagValue }) {
  return <span className={`${styles.tag} ${TAG[tag.tone]}`}>{tag.text}</span>;
}

export function Entries({ rows }: { rows: EntryRow[] }) {
  return (
    <ul className={styles.ents}>
      {rows.map((r) => (
        <li key={r.id} className={styles.ent}>
          <span className={styles.entTime}>{r.time}</span>
          <span className={styles.entNote}>{r.note}</span>
          <span className={styles.entMins}>{r.minutes}</span>
        </li>
      ))}
    </ul>
  );
}
