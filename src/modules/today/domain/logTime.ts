import type { DayObjective } from "@/shared/contract";
import { overlapping, spanLabel } from "@/modules/effort/domain/validateWrite";
import { compact, total } from "./todayView";

/**
 * The Log time and Edit entry dialog's rules (`03-today.md`), pure: the times
 * it reads, its checks in the design's words, the hint, the button, the body
 * it sends and the toasts after. A draft that passes `checkEntry` gives a
 * body `validateEffortEntryWrite` accepts; a test proves it.
 */

/** The design caps a new note; the API allows more, so an old note may be longer. */
export const NOTE_MAX = 120;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A time as typed — "920", "0920", "9:20", "9.20", "21" — as "09:20", or null
 * when it isn't a time on a 24-hour clock.
 */
export function parseTime(typed: string): string | null {
  const s = typed.trim();
  const sep = /^(\d{1,2})[:.](\d{2})$/.exec(s);
  // Hours and minutes as typed: "9:20" splits at the mark, "920" before its
  // last two digits, and "21" is an hour.
  const hm: [string, string] | null = sep
    ? [sep[1], sep[2]]
    : /^\d{3,4}$/.test(s)
      ? [s.slice(0, -2), s.slice(-2)]
      : /^\d{1,2}$/.test(s)
        ? [s, "00"]
        : null;
  if (!hm) return null;
  const h = Number(hm[0]);
  const min = Number(hm[1]);
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
}

const minuteOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const timeOf = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Start to end in minutes, or null unless both are times and end is later. */
export function spanMinutes(start: string, end: string): number | null {
  const s = parseTime(start);
  const e = parseTime(end);
  if (!s || !e) return null;
  const n = minuteOf(e) - minuteOf(s);
  return n > 0 ? n : null;
}

/** The dialog's duration, "1h 00m", or "—" until the times are valid. */
export const durationLabel = (start: string, end: string): string => {
  const n = spanMinutes(start, end);
  return n === null ? "—" : total(n);
};

/** The clock in `zone` at `now`, "HH:MM". */
export function clockIn(now: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("hour")}:${get("minute")}`;
}

/**
 * **Now**: End is the current time; Start, when empty, an hour earlier — but
 * never before midnight, since an entry can't cross it.
 */
export function nowTimes(
  now: Date,
  zone: string,
  start: string,
): { start: string; end: string } {
  const end = clockIn(now, zone);
  return {
    start: start.trim() ? start : timeOf(Math.max(0, minuteOf(end) - 60)),
    end,
  };
}

export type Draft = {
  objectiveId: string | null;
  start: string;
  end: string;
  note: string;
};

/** An entry already on the page, as the overlap check needs it. */
export type PageEntry = {
  id: string;
  occurred_at_local?: string;
  minutes: number;
  note: string;
};

export const ENTRY_FIELDS = ["objective", "when", "note"] as const;
export type EntryField = (typeof ENTRY_FIELDS)[number];

export type EntryBody = {
  local_date: string;
  tz: string;
  occurred_at_local: string;
  minutes: number;
  note: string;
};

export type CheckedEntry =
  | { ok: true; objectiveId: string; body: EntryBody }
  | {
      ok: false;
      errors: Partial<Record<EntryField, string>>;
      first: EntryField;
    };

/** "Two-pointer problems — four…": a note cut to fit an error line. */
export const cut = (note: string, max = 27): string =>
  note.length > max ? `${note.slice(0, max).trimEnd()}…` : note;

/**
 * Every check in the design, in its words and the dialog's order, or the body
 * to send. `date` and `zone` are the day Today shows; `entries` every entry on
 * the page; `editing` the entry being edited, which never clashes with itself.
 */
export function checkEntry(
  draft: Draft,
  ctx: {
    date: string;
    zone: string;
    entries: readonly PageEntry[];
    editing?: PageEntry;
  },
): CheckedEntry {
  const errors: Partial<Record<EntryField, string>> = {};
  if (!draft.objectiveId) errors.objective = "Pick an objective.";

  const start = parseTime(draft.start);
  const end = parseTime(draft.end);
  let minutes: number | null = null;
  if (!start || !end) {
    errors.when = "Enter start and end in 24-hour time, like 09:20.";
  } else if (minuteOf(end) <= minuteOf(start)) {
    errors.when = "End time must be after start time.";
  } else {
    minutes = minuteOf(end) - minuteOf(start);
    const others = ctx.entries.filter(
      (e): e is PageEntry & { occurred_at_local: string } =>
        e.id !== ctx.editing?.id && e.occurred_at_local !== undefined,
    );
    const hit = overlapping({ occurred_at_local: start, minutes }, others);
    if (hit) {
      errors.when = `Overlaps ${spanLabel(hit)} (${cut(hit.note)}). Change the times.`;
    }
  }

  const note = draft.note.trim();
  // An old note longer than the design's cap stays saveable as it is.
  const max = Math.max(NOTE_MAX, ctx.editing?.note.length ?? 0);
  if (!note) errors.note = "Add a line about what you did.";
  else if (note.length > max) {
    errors.note = `Keep it to ${NOTE_MAX} characters.`;
  }

  const first = ENTRY_FIELDS.find((f) => errors[f]);
  if (first) return { ok: false, errors, first };
  return {
    ok: true,
    objectiveId: draft.objectiveId as string,
    body: {
      local_date: ctx.date,
      tz: ctx.zone,
      occurred_at_local: start as string,
      minutes: minutes as number,
      note,
    },
  };
}

/**
 * The hint under the times: what this entry does to today's plan. On edit,
 * the entry's old minutes come out of the logged figure first.
 */
export function hint(
  o: DayObjective | undefined,
  minutes: number | null,
  editing?: { objective_id: string; minutes: number },
): string | null {
  if (!o) return null;
  if (o.slot?.period_kind !== "day") return "Counts as extra, off-day time";
  const before =
    o.logged_minutes - (editing?.objective_id === o.id ? editing.minutes : 0);
  const left = o.slot.target_minutes - before - (minutes ?? 0);
  return left > 0
    ? `Leaves ${compact(left)} on today's plan`
    : "Meets today's plan";
}

/** "Log 1h", or "Log time" until the times are valid; "Save" when editing. */
export function buttonLabel(minutes: number | null, editing: boolean): string {
  if (editing) return "Save";
  return minutes === null ? "Log time" : `Log ${compact(minutes)}`;
}

/** The toasts after a save, and after its Undo (03-today.md). */
export const TOAST = {
  logged: (minutes: number, title: string) =>
    `Logged ${compact(minutes)} to ${title}.`,
  loggedUndone: "Entry removed.",
  updated: "Entry updated.",
  updatedUndone: "Change undone.",
  deleted: "Entry deleted.",
  deletedUndone: "Entry restored.",
  undoFailed: "Couldn't undo. Nothing was changed.",
} as const;

/** What the dialog says when the day turned while it was open. */
export const dayTurned = (longDate: string): string =>
  `${longDate} is over, so nothing was logged to it. Today now shows the new day.`;

/** What it says when a save fails for any other reason. */
export const SAVE_FAILED = "Couldn't save. Nothing was changed. Try again.";
