/**
 * An objective's status, derived from its status events (ADR-008: store the
 * facts, compute what follows). Pure — values in, values out.
 *
 * There is no status column any more. The status in force on a date is the
 * latest event on or before that date; "current" is the latest event outright.
 * An objective with no events has no status at all (ERD invariant 16), which is
 * why these return null rather than defaulting to active.
 */

export type ObjectiveStatus = "active" | "paused" | "completed" | "ended";

export type StatusChange =
  "created" | "paused" | "resumed" | "completed" | "ended";

/** The row shape as the repository returns it (snake_case, dates as strings). */
export type StatusEventRow = {
  /** The local day the change happened, YYYY-MM-DD (NFR-12). */
  occurred_on: string;
  change: StatusChange;
};

/** What each change leaves the objective in. No 'extended' — that is a segment. */
const STATUS_AFTER: Record<StatusChange, ObjectiveStatus> = {
  created: "active",
  paused: "paused",
  resumed: "active",
  completed: "completed",
  ended: "ended",
};

/**
 * The status in force on `date`, or null if the objective had no event on or
 * before it (it did not exist yet).
 *
 * Events on the same day are resolved by their order in the array — the
 * repository returns them oldest first, by `occurred_on` then `recorded_at`, so
 * the later write wins. Sorting here is stable, so that order survives.
 */
export function statusOn(
  events: readonly StatusEventRow[],
  date: string,
): ObjectiveStatus | null {
  const upto = events
    .filter((e) => e.occurred_on <= date)
    .slice()
    .sort((a, b) =>
      a.occurred_on < b.occurred_on
        ? -1
        : a.occurred_on > b.occurred_on
          ? 1
          : 0,
    );
  const last = upto[upto.length - 1];
  return last ? STATUS_AFTER[last.change] : null;
}

/** The objective's status now: the latest event, whenever it happened. */
export function currentStatus(
  events: readonly StatusEventRow[],
): ObjectiveStatus | null {
  const sorted = events
    .slice()
    .sort((a, b) =>
      a.occurred_on < b.occurred_on
        ? -1
        : a.occurred_on > b.occurred_on
          ? 1
          : 0,
    );
  const last = sorted[sorted.length - 1];
  return last ? STATUS_AFTER[last.change] : null;
}
