import type { ObjectiveStatus } from "@/shared/contract";
import { loggable } from "@/modules/today/domain/todayView";
import {
  datesBetween,
  parseIso,
} from "@/modules/objectives/domain/generateSlots";
import { thisWeek, type Kind } from "./deviationView";

/**
 * Log a deviation (`docs/design/screens/06-deviations.md`, *Log a deviation*),
 * pure: the week's day chips, the objectives a day can name, every check in
 * the design's words, and the bodies the dialog sends. The dialog draws
 * these and sends what `checkDeviation` hands it (I-12).
 */

/** The design's limits, shorter than the contract's. */
export const LIMITS = {
  what: 120,
  reasoning: 280,
  name: 40,
  description: 120,
  instead: 120,
} as const;

/** The pattern field's two choices that aren't a pattern. */
export const NONE = "none";
export const NEW = "new";

export type Draft = {
  kind: Kind | null;
  objectiveId: string | null;
  what: string;
  reasoning: string;
  /** A pattern's id, `NONE`, `NEW`, or nothing picked yet. */
  pattern: string | null;
  newName: string;
  newDescription: string;
  instead: string;
  minutes: string;
  date: string;
};

export const FIELDS = [
  "kind",
  "objective",
  "what",
  "reasoning",
  "pattern",
  "newName",
  "minutes",
  "date",
] as const;
export type Field = (typeof FIELDS)[number];

/** A new draft: nothing picked, the day today. */
export const emptyDraft = (today: string): Draft => ({
  kind: null,
  objectiveId: null,
  what: "",
  reasoning: "",
  pattern: null,
  newName: "",
  newDescription: "",
  instead: "",
  minutes: "",
  date: today,
});

/** An objective the dialog may offer. Today's carry no status: all are active. */
export type Pullable = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status?: ObjectiveStatus;
};

/**
 * The objectives that could take time on the date: active, with a plan that
 * covers it — the API's own rule for a deviation (422) and Log time's (G44).
 */
export function choicesFor(
  objectives: readonly Pullable[],
  date: string,
): Pullable[] {
  return objectives.filter(
    (o) => (o.status ?? "active") === "active" && loggable(o, date),
  );
}

/** A new day; an objective that day can't take is no longer picked. */
export function pickDay(
  draft: Draft,
  date: string,
  objectives: readonly Pullable[],
): Draft {
  const keeps = choicesFor(objectives, date).some(
    (o) => o.id === draft.objectiveId,
  );
  return { ...draft, date, objectiveId: keeps ? draft.objectiveId : null };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

export type DayChip = {
  date: string;
  /** "Mon". */
  label: string;
  /** "Mon 31 Aug, today". */
  name: string;
  disabled: boolean;
};

export const NOT_YET = "Hasn't happened yet";

/** Mon … Sun of this week; the days after today can't be picked. */
export function weekChips(today: string): DayChip[] {
  const { from, to } = thisWeek(today);
  return datesBetween(from, to).map((date) => {
    const d = new Date(parseIso(date));
    const label = WEEKDAYS[d.getUTCDay()];
    return {
      date,
      label,
      name: `${label} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${
        date === today ? ", today" : ""
      }`,
      disabled: date > today,
    };
  });
}

/** Minutes: digits only, four at most. */
export const fitMinutes = (typed: string): string =>
  typed.replace(/\D/g, "").slice(0, 4);

/** "3 before" beside a pattern; nothing for one never named yet. */
export const beforeCount = (occurrences: number): string | null =>
  occurrences > 0 ? `${occurrences} before` : null;

/** What the pattern button reads. */
export function patternLabel(
  pattern: string | null,
  patterns: readonly { id: string; name: string }[],
): string | null {
  if (pattern === NONE) return "None of these";
  if (pattern === NEW) return "+ Add a new pattern";
  return patterns.find((p) => p.id === pattern)?.name ?? null;
}

export const ERRORS = {
  kind: "Pick Chosen or Drifted.",
  objective: "Pick the objective it pulled you from.",
  what: "Describe what happened. This is what you'll read back at review.",
  reasoning: "Write why it seemed worth it. You'll test it at review.",
  pattern: "Pick the closest pattern, or None of these.",
  newName: "Name the pattern.",
  nameTaken:
    "You already have a pattern with that name. Pick it from the list.",
  minutes: "Enter the minutes.",
  overADay: "That's more than a day. Use 1440 or less.",
  date: "Pick the day it happened.",
} as const;

export const NO_OBJECTIVE = "No objective was running that day.";
export const PATTERNS_FAILED = "Couldn't load your patterns. Try again.";
export const NOT_RECORDED =
  "Couldn't record it. Nothing was recorded. Try again.";
export const TOAST = "Deviation recorded.";

export type PatternBody = { name: string; description?: string };

/** The contract's DeviationWrite. */
export type DeviationBody = {
  objective_ids: string[];
  local_date: string;
  tz: string;
  kind: Kind;
  what_happened: string;
  reasoning?: string;
  did_instead?: string;
  minutes: number;
  /** Null for a one-off, and for a new pattern until it has its id. */
  pattern_id: string | null;
};

export type Checked =
  | { ok: true; newPattern: PatternBody | null; body: DeviationBody }
  | { ok: false; errors: Partial<Record<Field, string>>; first: Field };

/** A name the user already has, compared as the database does: `lower(name)`. */
const taken = (name: string, patterns: readonly { name: string }[]) =>
  patterns.some((p) => p.name.trim().toLowerCase() === name.toLowerCase());

/** Every check before anything is sent, in field order. */
export function checkDeviation(
  draft: Draft,
  ctx: {
    today: string;
    tz: string;
    patterns: readonly { id: string; name: string }[];
    objectives: readonly Pullable[];
  },
): Checked {
  const what = draft.what.trim();
  const reasoning = draft.reasoning.trim();
  const newName = draft.newName.trim();
  const minutes = Number(draft.minutes || "0");
  const chosen = draft.kind === "chosen";
  const drifted = draft.kind === "drifted";
  const dayOk = draft.date !== "" && draft.date <= ctx.today;
  const objectiveOk =
    draft.objectiveId !== null &&
    choicesFor(ctx.objectives, draft.date).some(
      (o) => o.id === draft.objectiveId,
    );
  const patternOk =
    draft.pattern === NONE ||
    draft.pattern === NEW ||
    ctx.patterns.some((p) => p.id === draft.pattern);

  const errors: Partial<Record<Field, string>> = {};
  if (!draft.kind) errors.kind = ERRORS.kind;
  if (!objectiveOk) errors.objective = ERRORS.objective;
  if (!what) errors.what = ERRORS.what;
  if (chosen && !reasoning) errors.reasoning = ERRORS.reasoning;
  if (drifted && !patternOk) errors.pattern = ERRORS.pattern;
  if (drifted && draft.pattern === NEW) {
    if (!newName) errors.newName = ERRORS.newName;
    else if (taken(newName, ctx.patterns)) errors.newName = ERRORS.nameTaken;
  }
  if (minutes < 1) errors.minutes = ERRORS.minutes;
  else if (minutes > 1440) errors.minutes = ERRORS.overADay;
  if (!dayOk) errors.date = ERRORS.date;

  const first = FIELDS.find((f) => errors[f]);
  if (first) return { ok: false, errors, first };

  const instead = draft.instead.trim();
  const description = draft.newDescription.trim();
  const isNew = drifted && draft.pattern === NEW;
  return {
    ok: true,
    newPattern: isNew
      ? { name: newName, ...(description ? { description } : {}) }
      : null,
    body: {
      objective_ids: [draft.objectiveId as string],
      local_date: draft.date,
      tz: ctx.tz,
      kind: draft.kind as Kind,
      what_happened: what,
      ...(chosen ? { reasoning } : {}),
      ...(instead ? { did_instead: instead } : {}),
      minutes,
      pattern_id:
        drifted && draft.pattern !== NONE && !isNew ? draft.pattern : null,
    },
  };
}
