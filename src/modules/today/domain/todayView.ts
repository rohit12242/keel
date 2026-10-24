import type { Day, DayObjective } from "@/shared/contract";
import { parseIso } from "@/modules/objectives/domain/generateSlots";
import { dayLabel } from "@/modules/objectives/domain/newObjective";
import { spanLabel } from "@/modules/effort/domain/validateWrite";

/**
 * Today's page rules (`docs/design/screens/03-today.md`), pure: the words and
 * figures the page shows, from the day alone. Every figure is the day's own;
 * this file only counts and formats, and decides which card an objective
 * gets from the dates the day carries (G26, G44, G45).
 */

/** Totals read "2h 00m" (the design's rule 6). */
export function total(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** Compact places read "45m", "1h 40m", "2h". */
export function compact(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The eyebrow: "Saturday, 5 September". */
export function longDate(date: string): string {
  const d = new Date(parseIso(date));
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** The schedule pill, "Fixed · Mon–Sat", from the day's own label. */
export function schedulePill(label: string): string {
  const [mode, days] = label.split(" · ");
  const words = (s: string) =>
    s
      .toLowerCase()
      .replace(
        /(^|[\s,–])([a-z])/g,
        (_, sep: string, c: string) => sep + c.toUpperCase(),
      );
  return days ? `${words(mode)} · ${words(days)}` : words(mode);
}

export type Summary = {
  /** Percent of today's planned time logged; null on a day off. */
  ring: number | null;
  total: string;
  /** "logged today · " then the strong part, then the rest. */
  strong: string | null;
  rest: string;
  /** The day-off sentence, when nothing is planned and nothing logged. */
  dayOff: string | null;
  week: string;
  extra: string;
};

export function summary(day: Day): Summary {
  const t = day.totals;
  const planned = t.today_planned_minutes;
  const base = {
    total: total(t.today_minutes),
    week: total(t.week_minutes),
    extra: total(t.extra_off_day_minutes),
  };
  if (planned === 0) {
    return t.today_minutes === 0
      ? {
          ...base,
          ring: null,
          strong: null,
          rest: "",
          dayOff: "Nothing is planned today. Anything you log counts as extra.",
        }
      : {
          ...base,
          ring: null,
          strong: "all of it extra",
          rest: ", nothing was planned",
          dayOff: null,
        };
  }
  const ring = Math.round(((planned - t.today_to_go_minutes) / planned) * 100);
  return t.today_to_go_minutes > 0
    ? {
        ...base,
        ring,
        strong: `${compact(t.today_to_go_minutes)} to go`,
        rest: ` of ${compact(planned)} planned`,
        dayOff: null,
      }
    : {
        ...base,
        ring,
        strong: "plan met",
        rest: ` for all ${compact(planned)}`,
        dayOff: null,
      };
}

/** Whether the objective's plan covers the date, so time can be logged (G44). */
export const loggable = (o: DayObjective, date: string): boolean =>
  o.start_date <= date && date <= o.end_date;

export type Card =
  | {
      kind: "planned";
      note: string;
      /** The note in the met colour, with its words. */
      met: boolean;
      /** "1h 40m", of "2h 00m". */
      logged: string;
      of: string;
      /** 0–1, for the bar. */
      progress: number;
    }
  | {
      kind: "other";
      note: string;
      /** Log anyway, when the plan covers today. */
      canLog: boolean;
    };

/** Which card an objective gets, and what it says (03-today.md). */
export function card(o: DayObjective, date: string): Card {
  if (o.slot?.period_kind === "day") {
    const target = o.slot.target_minutes;
    const logged = o.logged_minutes;
    const note =
      logged < target
        ? `${compact(target - logged)} to go`
        : logged === target
          ? "Planned time met"
          : `Planned time met · +${compact(logged - target)} over`;
    return {
      kind: "planned",
      note,
      met: logged >= target,
      logged: total(logged),
      of: total(target),
      progress: target > 0 ? Math.min(1, logged / target) : 1,
    };
  }
  if (date > o.end_date) {
    return {
      kind: "other",
      note: `Plan ended ${dayLabel(o.end_date, date)} · final review due`,
      canLog: false,
    };
  }
  const extra =
    o.logged_minutes > 0 ? ` · ${compact(o.logged_minutes)} extra today` : "";
  if (date < o.start_date || o.next_planned_date) {
    const next = o.next_planned_date ?? o.start_date;
    return {
      kind: "other",
      note: `Not planned today · next on ${dayLabel(next, date)}${extra}`,
      canLog: loggable(o, date),
    };
  }
  return {
    kind: "other",
    note: `Not planned again · plan ends ${dayLabel(o.end_date, date)}${extra}`,
    canLog: true,
  };
}

export type RailRow =
  | {
      kind: "track";
      pill: "On track" | "At risk" | "Behind";
      tone: "ok" | "risk" | "behind";
      pct: number;
    }
  | { kind: "label"; text: string };

const DAY_MS = 86_400_000;

/** The rail's Plan to date row (G25, G26). */
export function railRow(o: DayObjective, date: string): RailRow {
  if (o.start_date > date) return { kind: "label", text: "Not started" };
  if (o.track === null) {
    const n = (parseIso(date) - parseIso(o.start_date)) / DAY_MS + 1;
    return { kind: "label", text: `Day ${n}` };
  }
  const pct = o.adherence_to_date;
  switch (o.track) {
    case "on_track":
      return { kind: "track", pill: "On track", tone: "ok", pct };
    case "at_risk":
      return { kind: "track", pill: "At risk", tone: "risk", pct };
    case "behind":
      return { kind: "track", pill: "Behind", tone: "behind", pct };
  }
}

export type EntryRow = {
  id: string;
  /** "09:20–10:20", or "—" for an entry logged with no start (before G29). */
  time: string;
  note: string;
  minutes: string;
};

/** A card's entries, oldest first by start time; one with no start goes first. */
export function entryRows(o: DayObjective): EntryRow[] {
  return [...o.entries]
    .sort((a, b) =>
      (a.occurred_at_local ?? "").localeCompare(b.occurred_at_local ?? ""),
    )
    .map((e) => ({
      id: e.id,
      time: e.occurred_at_local
        ? spanLabel({
            occurred_at_local: e.occurred_at_local,
            minutes: e.minutes,
          })
        : "—",
      note: e.note,
      minutes: compact(e.minutes),
    }));
}
