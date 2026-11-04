import type { ParkedIdea } from "@/shared/contract";
import { NAME_MAX, TEXT_MAX } from "@/modules/objectives/domain/newObjective";
import { shortDate } from "./parkingView";

/**
 * New objective's "Start from" card (`docs/design/screens/04-objectives.md`),
 * pure: which ideas it offers, their lines, the search, what a pick fills
 * in, and the check. Only an approved idea can be taken (G4).
 */

export type Origin = "scratch" | "idea" | null;

/** The approved ideas, in the API's order (newest caught first). */
export const approvedIdeas = (ideas: readonly ParkedIdea[]) =>
  ideas.filter((i) => i.verdict === "approved");

/** The "An approved idea" card's line. */
export function approvedLine(n: number): string {
  if (n === 0) return "None approved yet in the Parking lot.";
  if (n === 1) return "1 idea in the Parking lot is approved and waiting.";
  return `${n} ideas in the Parking lot are approved and waiting.`;
}

/** "Caught 31 Aug · approved 22 Sep". */
export const ideaMeta = (idea: ParkedIdea, today: string) =>
  `Caught ${shortDate(idea.caught_on, today)} · approved ${shortDate(idea.verdict_on, today)}`;

/** The search shows only when there's more than one to search. */
export const showSearch = (ideas: readonly ParkedIdea[]) => ideas.length > 1;

/** Ideas whose text or why holds the query, ignoring case. */
export function search(
  ideas: readonly ParkedIdea[],
  query: string,
): ParkedIdea[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...ideas];
  return ideas.filter(
    (i) => i.idea.toLowerCase().includes(q) || i.why.toLowerCase().includes(q),
  );
}

type Filled = { name: string; why: string };

/** What an idea puts in Name and Why, cut to their limits. */
const fillOf = (idea: ParkedIdea): Filled => ({
  name: idea.idea.slice(0, NAME_MAX),
  why: idea.why.slice(0, TEXT_MAX),
});

/**
 * Name and Why after picking `next`: each is filled only when it is empty
 * or still holds what the previous pick put there, so typing is never lost.
 */
export function fillFrom(
  current: Filled,
  previous: ParkedIdea | null,
  next: ParkedIdea,
): Filled {
  const before = previous ? fillOf(previous) : { name: "", why: "" };
  const after = fillOf(next);
  const keep = (field: keyof Filled) =>
    current[field] === "" || current[field] === before[field]
      ? after[field]
      : current[field];
  return { name: keep("name"), why: keep("why") };
}

export const START_ERROR = "Pick an approved idea, or start from scratch.";

/** The card's check: a choice, and with an idea, the idea. */
export function checkStart(origin: Origin, ideaId: string | null) {
  if (origin === "scratch") return null;
  if (origin === "idea" && ideaId !== null) return null;
  return START_ERROR;
}

export const START_HINT =
  "Picking one fills in the name and why. It moves to Taken when you create the objective.";
export const NONE_APPROVED =
  "No approved ideas yet. Approve one in the Parking lot, then come back.";
export const NO_LONGER_APPROVED =
  "That idea is no longer approved. Pick another, or start from scratch.";
export const IDEAS_UNREACHABLE =
  "Couldn't reach the Parking lot. You can start from scratch.";
