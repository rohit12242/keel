import type {
  Deviation,
  DeviationList,
  DeviationPattern,
  PlanWeek,
} from "@/shared/contract";
import { total } from "@/modules/today/domain/todayView";
import { mondayOf } from "@/modules/effort/domain/effortMonth";
import {
  datesBetween,
  parseIso,
  toIso,
} from "@/modules/objectives/domain/generateSlots";
import { dayLabel, duration } from "@/modules/objectives/domain/newObjective";

/**
 * Every place that shows a deviation (`docs/design/screens/06-deviations.md`,
 * the Deviations tab in `04-objectives.md`, Today's rail in `03-today.md`),
 * pure: the words and lines, from the API's deviations and the day the API
 * calls today. The cost by kind is the API's; this file only adds a list's
 * minutes and counts it by kind or by plan week, and formats (I-12).
 */

export type Kind = Deviation["kind"];
export type Cost = DeviationList["cost"];
/** An objective's title by its id. */
export type Names = ReadonlyMap<string, string>;

const DAY_MS = 86_400_000;
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

/** "4 Sep". */
const shortDay = (date: string) => {
  const d = new Date(parseIso(date));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** "Mon 31": a day chip. */
const chipLabel = (date: string) => {
  const d = new Date(parseIso(date));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
};

export const KIND_LABEL: Record<Kind, string> = {
  chosen: "Chosen",
  drifted: "Drifted",
};

/** "1 deviation", "2 deviations". */
export const countWord = (n: number): string =>
  `${n} deviation${n === 1 ? "" : "s"}`;

/** "1st", "2nd", "3rd", "11th", "22nd". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

// ---------- The week ----------

export type Week = { from: string; to: string; range: string };

/** Monday to Sunday around today: the page's range, "31 Aug – 6 Sep". */
export function thisWeek(today: string): Week {
  const from = mondayOf(today);
  const to = toIso(parseIso(from) + 6 * DAY_MS);
  return { from, to, range: `${shortDay(from)} – ${shortDay(to)}` };
}

// ---------- The Deviations page ----------

export type KindFilter = "all" | Kind;

export const FILTERS: readonly { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "chosen", label: "Chosen" },
  { id: "drifted", label: "Drifted" },
];

/** All · Chosen · Drifted with the API's counts. */
export function filters(
  cost: Cost,
): { id: KindFilter; label: string; count: number }[] {
  const count: Record<KindFilter, number> = {
    all: cost.chosen.count + cost.drifted.count,
    chosen: cost.chosen.count,
    drifted: cost.drifted.count,
  };
  return FILTERS.map((f) => ({ ...f, count: count[f.id] }));
}

/** The filter's deviations, in the API's order: newest first. */
export function inFilter<T extends Pick<Deviation, "kind">>(
  list: readonly T[],
  filter: KindFilter,
): T[] {
  return list.filter((d) => filter === "all" || d.kind === filter);
}

/** "Nothing chosen this week." */
export const emptyFilter = (filter: Kind): string =>
  `Nothing ${filter} this week.`;

/** The week box: "Off plan this week 6h 15m | Chosen 5h 00m | Drifted 1h 15m". */
export function weekBox(cost: Cost): {
  all: string;
  chosen: string;
  drifted: string;
} {
  return {
    all: total(cost.chosen.minutes + cost.drifted.minutes),
    chosen: total(cost.chosen.minutes),
    drifted: total(cost.drifted.minutes),
  };
}

/** Every objective it names: "Python and DSA, Writing". */
export const pulledFrom = (d: Pick<Deviation, "objective_ids">, names: Names) =>
  d.objective_ids
    .map((id) => names.get(id))
    .filter((n): n is string => n !== undefined)
    .join(", ");

export type Row = {
  id: string;
  kind: Kind;
  /** "Wed 2 Sep · Python and DSA". */
  meta: string;
  text: string;
  duration: string;
};

export function row(d: Deviation, names: Names, today: string): Row {
  return {
    id: d.id,
    kind: d.kind,
    meta: `${dayLabel(d.local_date, today)} · ${pulledFrom(d, names)}`,
    text: d.what_happened,
    duration: duration(d.minutes),
  };
}

export type Detail = {
  kind: Kind;
  title: string;
  tiles: { label: string; value: string }[];
  /** Chosen: the reasoning. */
  reasoning: string | null;
  /** Drifted: its pattern, "3rd time" and the pattern's description. */
  pattern: {
    name: string;
    nth: string | null;
    description: string | null;
  } | null;
  didInstead: string | null;
  verdict: string;
};

export const CANT_CHANGE = "Recorded deviations can't be edited or deleted.";

/** The verdict at review, once given; until then, which review will give it. */
function verdictLine(d: Deviation): string {
  if (d.verdict === "worth_it") return "Worth it, at review.";
  if (d.verdict === "not_worth_it") return "Not worth it, at review.";
  if (d.review_due_on === null) return "Not reviewed yet.";
  const at = shortDay(d.review_due_on);
  return d.kind === "chosen"
    ? `Not reviewed yet. At the ${at} review you'll mark whether the reasoning held.`
    : `Not reviewed yet. It counts toward the pattern at the ${at} review.`;
}

/** The detail: "3rd time" is the API's `pattern_nth` (G32), the review its `review_due_on` (G33). */
export function detail(
  d: Deviation,
  names: Names,
  patterns: readonly DeviationPattern[],
  today: string,
): Detail {
  const pattern = patterns.find((p) => p.id === d.pattern_id);
  return {
    kind: d.kind,
    title: d.what_happened,
    tiles: [
      { label: "Time off plan", value: duration(d.minutes) },
      { label: "Pulled from", value: pulledFrom(d, names) },
      { label: "When", value: dayLabel(d.local_date, today) },
    ],
    reasoning: d.kind === "chosen" ? (d.reasoning ?? null) : null,
    pattern:
      d.kind === "chosen"
        ? null
        : d.pattern_id === null
          ? { name: "A one-off · no pattern", nth: null, description: null }
          : {
              name: d.pattern_name ?? pattern?.name ?? "",
              nth: d.pattern_nth ? `${ordinal(d.pattern_nth)} time` : null,
              description: pattern?.description ?? null,
            },
    didInstead: d.did_instead ?? null,
    verdict: verdictLine(d),
  };
}

// ---------- Today's rail ----------

export type LastCard = {
  id: string;
  kind: Kind;
  text: string;
  /** "4 Sep · 45m · Research spiral". */
  line: string;
  /** In this week, so the Deviations page lists it. */
  openable: boolean;
};

export function lastCard(d: Deviation, today: string): LastCard {
  return {
    id: d.id,
    kind: d.kind,
    text: d.what_happened,
    line: [shortDay(d.local_date), duration(d.minutes), d.pattern_name]
      .filter(Boolean)
      .join(" · "),
    openable: d.local_date >= thisWeek(today).from,
  };
}

// ---------- An objective's Deviations tab ----------

export const NONE_ON_OBJECTIVE =
  "No deviations recorded against this objective.";

/** "2 deviations · 6h 15m off plan · Chosen 5h 00m · Drifted 1h 15m"; null with none. */
export function tabSummary(
  cost: Cost,
): { count: string; all: string; chosen: string; drifted: string } | null {
  const n = cost.chosen.count + cost.drifted.count;
  if (n === 0) return null;
  return { count: countWord(n), ...weekBox(cost) };
}

/** "5h 00m · Research spiral". */
const itemLine = (d: Deviation) =>
  [duration(d.minutes), d.pattern_name].filter(Boolean).join(" · ");

export type Item = {
  id: string;
  kind: Kind;
  text: string;
  line: string;
  reasoning: string | null;
};

const itemOf = (d: Deviation): Item => ({
  id: d.id,
  kind: d.kind,
  text: d.what_happened,
  line: itemLine(d),
  reasoning: d.kind === "chosen" ? (d.reasoning ?? null) : null,
});

/** Most recent: the newest, with **Open in Deviations** when it's this week. */
export function mostRecent(
  list: readonly Deviation[],
  today: string,
): (Item & { date: string; openable: boolean }) | null {
  const d = list[0];
  if (!d) return null;
  return {
    ...itemOf(d),
    date: dayLabel(d.local_date, today),
    openable: d.local_date >= thisWeek(today).from,
  };
}

const inWeek = (list: readonly Deviation[], w: PlanWeek) =>
  list.filter(
    (d) => d.local_date >= w.period_start && d.local_date <= w.period_end,
  );

const minutesOf = (list: readonly Deviation[], kind?: Kind) =>
  list
    .filter((d) => !kind || d.kind === kind)
    .reduce((sum, d) => sum + d.minutes, 0);

export type WeekRow = {
  n: number;
  week: PlanWeek;
  /** "Week 2 · Mon 31 Aug – Sun 6 Sep". */
  label: string;
  soFar: boolean;
  count: number;
  /** "5h 00m", or "—" when none. */
  chosen: string;
  drifted: string;
};

const orDash = (minutes: number) => (minutes ? duration(minutes) : "—");

/** By week: the plan's weeks that have begun, with their deviations counted. */
export function byWeek(
  weeks: readonly PlanWeek[],
  list: readonly Deviation[],
  today: string,
): WeekRow[] {
  return weeks
    .filter((w) => w.period_start <= today)
    .map((w, i) => {
      const own = inWeek(list, w);
      return {
        n: i + 1,
        week: w,
        label: `Week ${i + 1} · ${dayLabel(w.period_start, today)} – ${dayLabel(w.period_end, today)}`,
        soFar: w.period_end > today,
        count: own.length,
        chosen: orDash(minutesOf(own, "chosen")),
        drifted: orDash(minutesOf(own, "drifted")),
      };
    });
}

export type DeviationWeek = {
  title: string;
  /** "Sun 30 Aug – Sat 5 Sep · 1 deviation · 5h 00m off plan". */
  sub: string;
  days: {
    date: string;
    chip: string;
    title: string;
    items: Item[];
    /** "No deviations." when the day has none. */
    empty: string | null;
  }[];
};

/** The week dialog: one block per day up to today. */
export function deviationWeek(
  row: Pick<WeekRow, "n" | "week">,
  list: readonly Deviation[],
  today: string,
): DeviationWeek {
  const { week: w, n } = row;
  const own = inWeek(list, w);
  const last = w.period_end < today ? w.period_end : today;
  return {
    title: `Deviations · Week ${n}`,
    sub: [
      `${dayLabel(w.period_start, today)} – ${dayLabel(w.period_end, today)}`,
      countWord(own.length),
      `${total(minutesOf(own))} off plan`,
    ].join(" · "),
    days: datesBetween(w.period_start, last).map((date) => {
      const items = own.filter((d) => d.local_date === date).map(itemOf);
      return {
        date,
        chip: chipLabel(date),
        title: dayLabel(date, today),
        items,
        empty: items.length === 0 ? "No deviations." : null,
      };
    }),
  };
}

/** So far's Deviation time: "6h 15m", hint "2 deviations". */
export function deviationTile(cost: Cost): {
  label: string;
  value: string;
  hint: string;
} {
  const n = cost.chosen.count + cost.drifted.count;
  return {
    label: "Deviation time",
    value: total(cost.chosen.minutes + cost.drifted.minutes),
    hint: n === 0 ? "No deviations" : countWord(n),
  };
}
