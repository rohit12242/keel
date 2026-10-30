import type {
  EffortEntry,
  Objective,
  PlanWeek,
  ScheduleDay,
} from "@/shared/contract";
import {
  compact,
  rowsOf,
  total,
  type EntryRow,
} from "@/modules/today/domain/todayView";
import { parseIso } from "./generateSlots";
import { dayLabel } from "./newObjective";
import type { Tone } from "./objectiveView";

/**
 * The Effort tab's rules (`docs/design/screens/04-objectives.md`, *Effort
 * tab*), pure: the Last day card, the By week rows and the week dialog. A
 * day's tag and figures are the schedule grid's, its entries the API's for
 * that range, and the weeks the objective's own `weeks` — none of it worked
 * out here (I-11).
 */

export type Tag = { text: string; tone: Tone };

/** A day's result in words, from the grid's state and its minutes. */
export function dayTag(day: ScheduleDay): Tag {
  const logged = day.logged_minutes ?? 0;
  const target = day.target_minutes ?? 0;
  switch (day.state) {
    case "target_met":
      return {
        text:
          logged > target
            ? `✓ Met · +${compact(logged - target)} over`
            : "✓ Met",
        tone: "ok",
      };
    case "worked_short":
      return { text: `− Short ${compact(target - logged)}`, tone: "risk" };
    case "planned_no_log":
      return { text: "✕ Missed", tone: "behind" };
    case "off_day_worked":
      return { text: "+ Extra on an off day", tone: "accent" };
    case "off_day":
      return { text: "Off day", tone: "neutral" };
  }
}

const entriesOn = (entries: readonly EffortEntry[], date: string) =>
  rowsOf(entries.filter((e) => e.local_date === date));

const count = (n: number) => `${n} entr${n === 1 ? "y" : "ies"}`;

/** The grid's day, or an off day with nothing on it when the grid lacks it. */
const dayIn = (grid: readonly ScheduleDay[], date: string): ScheduleDay =>
  grid.find((d) => d.date === date) ?? {
    date,
    state: "off_day",
    segment_id: "",
  };

export type LastDay =
  | { kind: "none"; text: string }
  | {
      kind: "day";
      /** "Sat 5 Sep", or "Sat 5 Sep · today". */
      title: string;
      /** "planned 2h 00m · 2 entries", or "off day · 1 entry". */
      line: string;
      /** The track bar's fill against the target, or null on an off day. */
      bar: { pct: number; met: boolean } | null;
      logged: string;
      tag: Tag;
      rows: EntryRow[];
    };

/** The Last day card: the latest date with entries, even if it is today. */
export function lastDay(
  o: Pick<Objective, "last_logged_on">,
  grid: readonly ScheduleDay[],
  entries: readonly EffortEntry[],
  today: string,
): LastDay {
  const date = o.last_logged_on;
  if (!date) return { kind: "none", text: "Nothing logged yet." };
  const day = dayIn(grid, date);
  const logged = day.logged_minutes ?? 0;
  const target = day.target_minutes ?? 0;
  const rows = entriesOn(entries, date);
  return {
    kind: "day",
    title: `${dayLabel(date, today)}${date === today ? " · today" : ""}`,
    line: `${target > 0 ? `planned ${total(target)}` : "off day"} · ${count(rows.length)}`,
    bar:
      target > 0
        ? {
            pct: Math.min(100, Math.round((logged / target) * 1000) / 10),
            met: logged >= target,
          }
        : null,
    logged: compact(logged),
    tag: dayTag(day),
    rows,
  };
}

export type WeekRow = {
  n: number;
  week: PlanWeek;
  /** "Week 2 · Mon 31 Aug – Sun 6 Sep". */
  label: string;
  soFar: boolean;
  planned: string;
  logged: string;
  met: string;
  over: string;
  unplanned: string;
};

const weekLabel = (n: number, w: PlanWeek, today: string) =>
  `Week ${n} · ${dayLabel(w.period_start, today)} – ${dayLabel(w.period_end, today)}`;

const overOf = (minutes: number | undefined) =>
  minutes ? `+${compact(minutes)}` : "0m";

/** By week: the plan's weeks that have begun, Week 1 onwards. */
export function weekRows(
  o: Pick<Objective, "weeks">,
  today: string,
): WeekRow[] {
  return o.weeks
    .filter((w) => w.period_start <= today)
    .map((w, i) => ({
      n: i + 1,
      week: w,
      label: weekLabel(i + 1, w, today),
      soFar: w.period_end > today,
      planned: total(w.figures.target_minutes),
      logged: total(w.figures.logged_minutes),
      met: `${w.figures.target_met_days ?? 0} of ${w.figures.planned_days ?? 0}`,
      over: overOf(w.figures.over_target_minutes),
      unplanned: compact(w.figures.extra_off_day_minutes ?? 0),
    }));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon 31": a day chip. */
const chipLabel = (date: string) => {
  const d = new Date(parseIso(date));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
};

export type DayBlock = {
  date: string;
  chip: string;
  /** "Sat 5 Sep · planned 2h", or "Sun 6 Sep · off day". */
  title: string;
  logged: string;
  tag: Tag;
  rows: EntryRow[];
  /** "Nothing logged." when the day has no entries. */
  empty: string | null;
};

export type WeekDialog = {
  title: string;
  /** "Planned 12h 00m · logged 10h 25m · 3 of 6 met · +30m over plan". */
  sub: string;
  days: DayBlock[];
};

/** The week dialog: one block per day up to today, from the grid and entries. */
export function weekDialog(
  row: Pick<WeekRow, "n" | "week">,
  grid: readonly ScheduleDay[],
  entries: readonly EffortEntry[],
  today: string,
): WeekDialog {
  const { week: w, n } = row;
  const f = w.figures;
  const over = f.over_target_minutes ?? 0;
  const days = grid
    .filter(
      (d) =>
        d.date >= w.period_start && d.date <= w.period_end && d.date <= today,
    )
    .map((d) => {
      const target = d.target_minutes ?? 0;
      const rows = entriesOn(entries, d.date);
      return {
        date: d.date,
        chip: chipLabel(d.date),
        title: `${dayLabel(d.date, today)} · ${
          target > 0 ? `planned ${compact(target)}` : "off day"
        }`,
        logged: compact(d.logged_minutes ?? 0),
        tag: dayTag(d),
        rows,
        empty: rows.length === 0 ? "Nothing logged." : null,
      };
    });
  return {
    title: weekLabel(n, w, today),
    sub: [
      `Planned ${total(f.target_minutes)}`,
      `logged ${total(f.logged_minutes)}`,
      `${f.target_met_days ?? 0} of ${f.planned_days ?? 0} met`,
      ...(over > 0 ? [`+${compact(over)} over plan`] : []),
    ].join(" · "),
    days,
  };
}
