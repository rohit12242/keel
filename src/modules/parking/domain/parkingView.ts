import type { ParkedIdea } from "@/shared/contract";
import { parseIso } from "@/modules/objectives/domain/generateSlots";

/**
 * The Parking lot's words (`docs/design/screens/07-parking-lot.md`), pure:
 * the pills, the detail's lines, the verdicts and their toasts, from the
 * API's ideas and the day the API calls today. Every date is the API's —
 * the lock is never worked out here (`docs/domain/parking-lock.md`).
 */

/** What the page needs of an objective: its name and its dates. */
export type ObjectiveDates = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "31 Aug", with the year when it isn't today's: "5 Jan 2027". */
export function shortDate(date: string, today: string): string {
  const d = new Date(parseIso(date));
  const year = d.getUTCFullYear();
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${
    String(year) === today.slice(0, 4) ? "" : ` ${year}`
  }`;
}

export type IdeaState = "locked" | "open" | "approved" | "taken" | "dropped";

/** Parked splits in two by the lock; every other verdict is its own state. */
export function stateOf(idea: ParkedIdea): IdeaState {
  if (idea.verdict === "parked") return idea.locked ? "locked" : "open";
  return idea.verdict;
}

export type Pill = {
  state: IdeaState;
  /** The row's words. */
  row: string;
  /** The detail's words. */
  detail: string;
  /** A locked pill carries the ⓘ that shows the rule. */
  info: boolean;
};

const DECIDED: Record<"approved" | "taken" | "dropped", string> = {
  approved: "Approved",
  taken: "Taken",
  dropped: "Dropped",
};

/** The state pill, in the row and in the detail (G31 for the dates). */
export function pill(idea: ParkedIdea, today: string): Pill {
  const state = stateOf(idea);
  if (state === "locked") {
    const text = `Locked · opens ${shortDate(idea.locked_until, today)}`;
    return { state, row: text, detail: text, info: true };
  }
  if (state === "open") {
    return {
      state,
      row: "Open · decide now",
      detail: `Open since ${shortDate(idea.locked_until, today)} · decide now`,
      info: false,
    };
  }
  const text = `${DECIDED[state]} ${shortDate(idea.verdict_on, today)}${
    idea.decided_early ? " · early" : ""
  }`;
  return { state, row: text, detail: text, info: false };
}

export type StatusFilter = "all" | "parked" | "approved" | "taken" | "dropped";

/** The list's filter (Rohit, 2026-11-04): Parked is locked and open alike. */
export const FILTERS: readonly { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "parked", label: "Parked" },
  { id: "approved", label: "Approved" },
  { id: "taken", label: "Taken" },
  { id: "dropped", label: "Dropped" },
];

/** The filter named in the address, or All. */
export const filterOf = (asked: string | undefined): StatusFilter =>
  FILTERS.find((f) => f.id === asked)?.id ?? "all";

/** The filter's ideas, in the API's order. */
export function inFilter(
  ideas: readonly ParkedIdea[],
  filter: StatusFilter,
): ParkedIdea[] {
  return ideas.filter((i) => filter === "all" || i.verdict === filter);
}

/** Each filter with how many ideas it holds, counted from the list. */
export function filters(
  ideas: readonly ParkedIdea[],
): { id: StatusFilter; label: string; count: number }[] {
  return FILTERS.map((f) => ({ ...f, count: inFilter(ideas, f.id).length }));
}

/** "No taken ideas." */
export const emptyFilter = (filter: Exclude<StatusFilter, "all">) =>
  `No ${filter} ideas.`;

/**
 * The objective whose end set the lock: one running on `caughtOn` that ends
 * on `until`. Null when none matches — the name is then left out.
 */
export function lockSetter(
  until: string,
  caughtOn: string,
  objectives: readonly ObjectiveDates[],
): string | null {
  const o = objectives.find(
    (o) => o.end_date === until && o.start_date <= caughtOn,
  );
  return o ? o.title : null;
}

/** The ⓘ's tooltip on a locked pill. */
export function lockRule(
  idea: ParkedIdea,
  objectives: readonly ObjectiveDates[],
  today: string,
): string {
  const name = lockSetter(idea.locked_until, idea.caught_on, objectives);
  return `Locked until ${shortDate(idea.locked_until, today)}, the latest end date among the objectives running on ${shortDate(
    idea.caught_on,
    today,
  )}, the day you caught it${name ? ` (${name})` : ""}. Deciding earlier is recorded as early.`;
}

/** "Caught 31 Aug". */
export const caught = (idea: ParkedIdea, today: string) =>
  `Caught ${shortDate(idea.caught_on, today)}`;

/** The green line on an approved idea. */
export const approvedLine = (idea: ParkedIdea, today: string) =>
  `Approved on ${shortDate(idea.verdict_on, today)}. It moves to Taken when you pick it while creating an objective.`;

/** "Became an objective on 31 Aug, before it opened on 21 Sep. Runs 1 Sep – 2 Nov." */
export function takenLine(
  idea: ParkedIdea,
  objective: ObjectiveDates | undefined,
  today: string,
): string {
  const before = idea.decided_early
    ? `, before it opened on ${shortDate(idea.locked_until, today)}`
    : "";
  const runs = objective
    ? ` Runs ${shortDate(objective.start_date, today)} – ${shortDate(objective.end_date, today)}.`
    : "";
  return `Became an objective on ${shortDate(idea.verdict_on, today)}${before}.${runs}`;
}

export const FINAL = "The verdict is final. You can keep adding notes.";

/** Parked or approved can still be decided; taken and dropped are final. */
export const decidable = (idea: ParkedIdea) =>
  idea.verdict === "parked" || idea.verdict === "approved";

export type Verdict = "parked" | "approved" | "dropped";

/** The idea as it will read once its held verdict is sent (G13). */
export function heldIdea(
  idea: ParkedIdea,
  verdict: Verdict,
  note: string | null,
  day: string,
): ParkedIdea {
  return {
    ...idea,
    verdict,
    verdict_on: day,
    note,
    decided_early: verdict !== "parked" && day < idea.locked_until,
  };
}

export type VerdictBody = {
  verdict: Verdict;
  occurred_on: string;
  note?: string;
};

/** The body `POST /parked-ideas/{id}/verdicts` takes. The note as typed. */
export function verdictBody(
  verdict: Verdict,
  day: string,
  note: string | null,
): VerdictBody {
  return note === null
    ? { verdict, occurred_on: day }
    : { verdict, occurred_on: day, note };
}

const TOASTS: Record<Verdict, string> = {
  approved: "Approved. Pick it when you create an objective.",
  parked: "Back in Parked.",
  dropped: "Dropped. Both reasons are kept.",
};

export const verdictToast = (v: Verdict) => TOASTS[v];

export const UNDONE = "Undone.";
export const ALREADY_SENT = "Already saved; it can't be undone now.";
export const VERDICT_NOT_SAVED =
  "Couldn't save your verdict. Nothing was changed. Try again.";
export const CHANGED_ELSEWHERE =
  "This idea changed somewhere else. Nothing was changed here.";

/** Drop's reason: the design gives no limit; 280, like the other reasons. */
export const DROP_WHY_MAX = 280;

/** A drop says why it ended (parking-lock.md). */
export const checkDrop = (text: string): string | null =>
  text.trim() ? null : "Write why you're dropping it.";

export const EMPTY = {
  title: "Park the next idea that tries to pull you away.",
  body: "Write down the idea and why it grabbed you. It stays locked until the objectives you're running now have ended, so you can get back to work without losing it.",
  steps: [
    "Park it: the idea and why it grabbed you.",
    "It opens on the latest end date among the objectives running that day.",
    "Then decide: take it as an objective, or drop it and say why.",
  ],
} as const;
