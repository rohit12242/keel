import type {
  DeviationList,
  Objective,
  ObjectiveSummary,
  ReviewList,
} from "@/shared/contract";
import type { Filter } from "@/modules/objectives/domain/objectiveView";
import type { Read } from "../readApi";
import { ObjectiveDetail } from "./ObjectiveDetail";
import type { TabId } from "./tabs";
import { Filters, NoObjectives, ObjectiveList } from "./ObjectiveList";
import { ObjectivesHeader } from "./ObjectivesHeader";
import list from "../listDetail.module.css";
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
  deviations,
  reviews,
  flash = false,
  today,
  tz,
  tab,
}: {
  show: "list" | "detail";
  objectives: ObjectiveSummary[];
  filter: Filter;
  /** The open objective, or null when the filter has none. */
  detail: Read<Objective> | null;
  /** The open objective's deviations, or null when none is open. */
  deviations: Read<DeviationList> | null;
  /** The open objective's reviews, or null when none is open. */
  reviews: Read<ReviewList> | null;
  flash?: boolean;
  today: string;
  tz: string;
  /** The tab the open objective shows first (`?tab=`). */
  tab?: TabId;
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
    <div className={show === "detail" ? list.showDetail : list.showList}>
      <div className={list.listHead}>
        <ObjectivesHeader />
        <Filters objectives={objectives} filter={filter} />
      </div>
      <div className={list.wrap}>
        <ObjectiveList
          objectives={objectives}
          filter={filter}
          selected={open?.id ?? null}
          flash={flash}
          today={today}
        />
        <div className={list.detailCol}>
          {open ? (
            <ObjectiveDetail
              key={open.id}
              objective={open}
              deviations={
                deviations && typeof deviations === "object"
                  ? deviations.value
                  : null
              }
              reviews={
                reviews && typeof reviews === "object" ? reviews.value : null
              }
              today={today}
              tz={tz}
              initialTab={tab}
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
