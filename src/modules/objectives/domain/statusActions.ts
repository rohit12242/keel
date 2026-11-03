import type { Objective, ReviewSummary } from "@/shared/contract";
import { dayLabel, duration } from "./newObjective";

/**
 * Pause, resume, terminate and notes on the Overview (04-objectives.md,
 * *Overview* footer and *Pause, resume, terminate*; 01-shell.md, *Notes*),
 * pure: what the footer offers, the dialogs' words, the checks, the request
 * bodies and the toasts. The page only sends and shows (I-15).
 */

type Of = Pick<Objective, "status" | "end_date">;

export type Footer = { line: string; pause: boolean; terminate: boolean };

/**
 * The footer's words and actions. Pause while running or not started, never
 * once the plan has ended; Terminate until the status is final.
 */
export function footer(o: Of, today: string): Footer {
  switch (o.status) {
    case "active":
      return o.end_date < today
        ? {
            line: "The plan has ended. The final review decides what happens next.",
            pause: false,
            terminate: true,
          }
        : {
            line: "Schedule and target are fixed. They change only when you extend at the final review.",
            pause: true,
            terminate: true,
          };
    case "paused":
      return {
        line: "Resume to plan days again. Terminating can't be undone.",
        pause: false,
        terminate: true,
      };
    case "completed":
    case "ended":
      return {
        line: "This status is final. You can keep adding notes.",
        pause: false,
        terminate: false,
      };
  }
}

export type ReasonKind = "pause" | "terminate";

export type ReasonDialogWords = {
  title: string;
  body: string;
  label: string;
  hint: string | null;
  action: string;
  /** The action button is red (Terminate). */
  danger: boolean;
};

/** A reason is kept to this many characters, Pause and Terminate alike. */
export const REASON_MAX = 280;

export function dialogWords(
  kind: ReasonKind,
  o: Of,
  today: string,
): ReasonDialogWords {
  return kind === "pause"
    ? {
        title: "Pause this objective?",
        body: `Days stop being planned until you resume. The end date stays ${dayLabel(o.end_date, today)}, so paused days are not made up. Reviews wait too.`,
        label: "Why are you pausing?",
        hint: "It goes into the status history, word for word.",
        action: "Pause it",
        danger: false,
      }
    : {
        title: "Terminate this objective?",
        body: "It moves to Terminated and can't be resumed. Its effort, deviations, reviews and notes are kept.",
        label: "Why are you terminating it?",
        hint: null,
        action: "Terminate",
        danger: true,
      };
}

/** The line above Pause's buttons when time is logged on it today; else null. */
export function loggedToday(minutes: number): string | null {
  return minutes > 0
    ? `Today stops being planned. The ${duration(minutes)} logged today stays, as extra.`
    : null;
}

const REASON_ERROR: Record<ReasonKind, string> = {
  pause: "Write why you are pausing it.",
  terminate: "Write why you are terminating it.",
};

/** The design's error for a missing reason; spaces alone are missing. */
export function checkReason(kind: ReasonKind, text: string): string | null {
  return text.trim() === "" ? REASON_ERROR[kind] : null;
}

export type StatusBody = {
  change: "pause" | "resume" | "end";
  occurred_on: string;
  reason?: string;
};

const CHANGE: Record<ReasonKind | "resume", StatusBody["change"]> = {
  pause: "pause",
  terminate: "end",
  resume: "resume",
};

/** The contract's status change, dated `day` in the user's zone. The reason is sent as typed. */
export function statusBody(
  kind: ReasonKind | "resume",
  day: string,
  reason?: string,
): StatusBody {
  return {
    change: CHANGE[kind],
    occurred_on: day,
    ...(reason === undefined ? {} : { reason }),
  };
}

export const pausedToast = (o: Of, today: string): string =>
  `Paused. The end date stays ${dayLabel(o.end_date, today)}.`;

export const TERMINATED = "Terminated. Everything recorded is kept.";

/**
 * After a resume. Past the plan's end, the final review is due at once —
 * unless one for that end is already saved.
 */
export function resumedToast(
  o: Of,
  reviews: readonly Pick<ReviewSummary, "kind" | "period_end" | "status">[],
  today: string,
): string {
  const finalSaved = reviews.some(
    (r) =>
      r.kind === "plan_end" &&
      r.period_end === o.end_date &&
      r.status === "saved",
  );
  return o.end_date < today && !finalSaved
    ? "Resumed. Its plan has ended, so the final review is due."
    : "Resumed. It is back on Today.";
}

const VERB: Record<ReasonKind | "resume", string> = {
  pause: "pause",
  resume: "resume",
  terminate: "terminate",
};

/** A send that failed: what was typed stays, and nothing changed. */
export const notChanged = (kind: ReasonKind | "resume"): string =>
  `Couldn't ${VERB[kind]} it. Nothing was changed. Try again.`;

/** A 409: the status moved on elsewhere, so this change no longer follows. */
export const CHANGED_ELSEWHERE =
  "This objective changed somewhere else. Nothing was changed here.";

// ---------- Notes ----------

export const NOTE_MAX = 120;
export const NOTE_LINE = "Once saved, a note can't be edited or deleted.";
export const NOTE_SAVED = "Note saved.";
export const NOTE_NOT_SAVED =
  "Couldn't save the note. Nothing was saved. Try again.";

/** The contract's NoteWrite, or null for a note with nothing in it. */
export function noteBody(
  text: string,
  day: string,
): { written_on: string; text: string } | null {
  return text.trim() === "" ? null : { written_on: day, text };
}
