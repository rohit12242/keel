import type { ParkedIdea } from "@/shared/contract";
import { lockSetter, shortDate, type ObjectiveDates } from "./parkingView";

/**
 * Park an idea (`docs/design/screens/07-parking-lot.md`), pure: the checks
 * in the design's words, the body, the lock note and the toast. The lock
 * note's date is the API's `new_idea_locked_until` (G38), never worked out
 * here.
 */

/** The design's limits; the contract keeps longer ones. */
export const IDEA_MAX = 120;
export const WHY_MAX = 280;

export type IdeaDraft = { idea: string; why: string };
export type IdeaField = keyof IdeaDraft;

export type IdeaBody = { idea: string; why: string; caught_on: string };

export type CheckedIdea =
  | { ok: true; body: IdeaBody }
  | { ok: false; errors: Partial<Record<IdeaField, string>>; first: IdeaField };

/** Both checks at once; spaces alone are blank. The text is sent as typed. */
export function checkIdea(draft: IdeaDraft, day: string): CheckedIdea {
  const errors: Partial<Record<IdeaField, string>> = {};
  if (!draft.idea.trim()) errors.idea = "Enter the idea.";
  if (!draft.why.trim()) errors.why = "Add why it grabbed you.";
  if (errors.idea) return { ok: false, errors, first: "idea" };
  if (errors.why) return { ok: false, errors, first: "why" };
  return {
    ok: true,
    body: { idea: draft.idea, why: draft.why, caught_on: day },
  };
}

export type LockNote = { tone: "caution" | "muted"; text: string };

/**
 * The dialog's lock note, from the API's answer for today. Null until it
 * arrives, or when it couldn't be read: the note is then left out.
 */
export function lockNote(
  today: string,
  until: string | null,
  objectives: readonly ObjectiveDates[],
): LockNote | null {
  if (until === null) return null;
  if (until <= today) {
    return {
      tone: "muted",
      text: "No objectives are running, so it opens straight away.",
    };
  }
  const name = lockSetter(until, today, objectives);
  return {
    tone: "caution",
    text: `Locked until ${shortDate(until, today)}, the earliest end date among the objectives running today${
      name ? ` (${name})` : ""
    }. Taking it or dropping it before then is recorded as early, not blocked.`,
  };
}

/** "Parked. Locked until 2 Nov." or, when it opened straight away, "Parked." */
export function parkedToast(idea: ParkedIdea, today: string): string {
  return idea.locked_until > idea.caught_on
    ? `Parked. Locked until ${shortDate(idea.locked_until, today)}.`
    : "Parked.";
}

export const NOT_PARKED = "Couldn't park it. Nothing was saved. Try again.";
