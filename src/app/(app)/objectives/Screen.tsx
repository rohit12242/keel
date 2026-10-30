import type { Objective, ObjectiveSummary } from "@/shared/contract";
import type { Filter } from "@/modules/objectives/domain/objectiveView";
import type { Read } from "../readApi";
import { ObjectiveDetail } from "./ObjectiveDetail";
import { Filters, NoObjectives, ObjectiveList } from "./ObjectiveList";
import { ObjectivesHeader } from "./ObjectivesHeader";
import styles from "./objectives.module.css";

/**
 * List and detail (01-shell.md): on desktop the list beside the open
 * objective; on phone one or the other — `/objectives` the list,
 * `/objectives/{id}` the detail, with **‹ Objectives**.
 */
export function Screen({
  show,
  objectives,
  filter,
  detail,
  flash = false,
  today,
}: {
  show: "list" | "detail";
  objectives: ObjectiveSummary[];
  filter: Filter;
  /** The open objective, or null when the filter has none. */
  detail: Read<Objective> | null;
  flash?: boolean;
  today: string;
}) {
  if (objectives.length === 0) {
    return (
      <>
        <ObjectivesHeader />
        <NoObjectives />
      </>
    );
  }
  const open = detail && typeof detail === "object" ? detail.value : null;
  return (
    <div className={show === "detail" ? styles.showDetail : styles.showList}>
      <div className={styles.listHead}>
        <ObjectivesHeader />
        <Filters objectives={objectives} filter={filter} />
      </div>
      <div className={styles.wrap}>
        <ObjectiveList
          objectives={objectives}
          filter={filter}
          selected={open?.id ?? null}
          flash={flash}
          today={today}
        />
        <div className={styles.detailCol}>
          {open ? (
            <ObjectiveDetail
              key={open.id}
              objective={open}
              today={today}
              backHref={`/objectives?status=${filter}`}
            />
          ) : detail ? (
            <Unreachable />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Unreachable() {
  return (
    <div className={styles.error} role="alert">
      <strong>Couldn&rsquo;t reach your objectives.</strong> Nothing has been
      lost — try again in a moment.
    </div>
  );
}
