import { DeviationsIcon, PlusIcon } from "@/app/icons";
import { KeyHint, PageHeader } from "../PageHeader";
import shell from "../shell.module.css";
import { KindPill } from "./KindPill";
import styles from "./deviations.module.css";

/**
 * The Deviations header (06-deviations.md): "This week · 31 Aug – 6 Sep"
 * ("This week ·" hidden on phone) and **+ Log a deviation** `D`.
 */
export function DeviationsHeader({ range }: { range: string | null }) {
  return (
    <PageHeader
      eyebrow={
        range ? (
          <>
            <span className={styles.thisWeek}>This week · </span>
            {range}
          </>
        ) : undefined
      }
      title="Deviations"
      action={
        <button type="button" className={shell.primary} aria-keyshortcuts="D">
          <PlusIcon />
          Log a deviation
          <KeyHint k="D" />
        </button>
      }
      phoneAction={
        <button
          type="button"
          className={`${shell.primary} ${shell.primarySmall}`}
        >
          <PlusIcon />
          Log a deviation
        </button>
      }
    />
  );
}

/** An empty week: what to record, the two kinds, and **Log a deviation**. */
export function EmptyWeek() {
  return (
    <section className={styles.emptyCard} aria-labelledby="no-deviations">
      <span className={styles.emptyIcon} aria-hidden="true">
        <DeviationsIcon />
      </span>
      <h2 id="no-deviations">No deviations this week.</h2>
      <p>
        When time goes somewhere other than the plan, record it. Recording it
        doesn&rsquo;t undo it. It makes it countable at review.
      </p>
      <ul className={styles.kinds}>
        <li>
          <KindPill kind="chosen" />
          You decided to go off, with a reason you&rsquo;ll test at review.
        </li>
        <li>
          <KindPill kind="drifted" />
          It happened to you, and you noticed afterwards.
        </li>
      </ul>
      <button type="button" className={shell.primary}>
        <PlusIcon />
        Log a deviation
      </button>
    </section>
  );
}
