import type {
  Figures,
  Objective,
  ObjectiveStatus,
  ObjectiveSummary,
  Schedule,
} from "@/shared/contract";
import { compact, total, trackWords } from "@/modules/today/domain/todayView";
import { parseIso } from "./generateSlots";
import { dayLabel, duration } from "./newObjective";

/**
 * The Objectives list and detail's rules (`docs/design/screens/04-objectives.md`),
 * pure: the words, pills and lines the page shows, from the API's objective
 * and the day the API calls today. Every figure is the API's; this file
 * only picks, counts and formats (I-11).
 */

const DAY_MS = 86_400_000;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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

const daysBetween = (a: string, b: string) =>
  (parseIso(b) - parseIso(a)) / DAY_MS;

/** "5 Sep": the short date the pills use. */
const shortDay = (date: string) => {
  const d = new Date(parseIso(date));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** "Every day", "Mon–Fri" for a run of three or more, else "Mon, Wed, Fri". */
function daysLabel(weekdays: readonly number[]): string {
  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  const run = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (run && sorted.length >= 3) {
    return `${DAYS[sorted[0] - 1]}–${DAYS[sorted[sorted.length - 1] - 1]}`;
  }
  return sorted.map((d) => DAYS[d - 1]).join(", ");
}

type ScheduleOf = Pick<
  Schedule,
  "mode" | "planned_weekdays" | "days_per_week" | "minutes_per_planned_day"
>;

/**
 * "Fixed · Mon–Sat · 2h a day". `per` writes the minutes: compact in the
 * list and the meta line, "2h 00m" in the status history.
 */
export function scheduleLine(
  s: ScheduleOf,
  per: (minutes: number) => string = compact,
): string {
  const days =
    s.mode === "fixed"
      ? daysLabel(s.planned_weekdays ?? [])
      : `${s.days_per_week ?? 0} days a week`;
  return [
    s.mode === "fixed" ? "Fixed" : "Flexible",
    days,
    `${per(s.minutes_per_planned_day)} a day`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export type PlanOf = {
  schedule: ScheduleOf;
  start_date: string;
  end_date: string;
  review_cadence?: "weekly" | "monthly";
};

/** "Fixed · Mon–Sat · 2h a day · weekly reviews · Sun 23 Aug – Mon 21 Sep". */
export function planLine(o: PlanOf, today: string): string {
  return [
    scheduleLine(o.schedule),
    ...(o.review_cadence ? [`${o.review_cadence} reviews`] : []),
    `${dayLabel(o.start_date, today)} – ${dayLabel(o.end_date, today)}`,
  ].join(" · ");
}

// ---------- The list ----------

export type Filter = ObjectiveStatus;

const LABELS: Record<Filter, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  ended: "Terminated",
};

/** The four filters, in the design's order. Terminated is the API's `ended`. */
export const FILTERS: readonly { id: Filter; label: string }[] = (
  ["active", "paused", "completed", "ended"] as const
).map((id) => ({ id, label: LABELS[id] }));

/** Every filter with its count, empty ones included. */
export function filters(
  objectives: readonly Pick<ObjectiveSummary, "status">[],
): { id: Filter; label: string; count: number }[] {
  return FILTERS.map((f) => ({
    ...f,
    count: objectives.filter((o) => o.status === f.id).length,
  }));
}

/** A filter's objectives, the latest start first. */
export function inFilter<
  T extends Pick<ObjectiveSummary, "status" | "start_date">,
>(objectives: readonly T[], filter: Filter): T[] {
  return objectives
    .filter((o) => o.status === filter)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
}

/** "Nothing paused." */
export function emptyLine(filter: Filter): string {
  return `Nothing ${LABELS[filter].toLowerCase()}.`;
}

export type Tone = "ok" | "risk" | "behind" | "accent" | "neutral";

export type Pill = { text: string; tone: Tone };

type Phase =
  "paused" | "terminated" | "completed" | "later" | "planEnded" | "running";

function phaseOf(o: ObjectiveSummary, today: string): Phase {
  if (o.status === "paused") return "paused";
  if (o.status === "ended") return "terminated";
  if (o.status === "completed") return "completed";
  if (o.start_date > today) return "later";
  if (o.end_date < today) return "planEnded";
  return "running";
}

/** How many days the plan runs, and which of them today is. */
function dayOf(o: ObjectiveSummary, today: string) {
  const total = daysBetween(o.start_date, o.end_date) + 1;
  return {
    total,
    n: Math.min(total, Math.max(1, daysBetween(o.start_date, today) + 1)),
  };
}

export type Row = {
  /** Days elapsed of the whole run, 0–100. */
  progress: number;
  /** "Day 14 of 30", "Starts Sun 6 Sep", "Mar – Aug · 25 weeks"… */
  when: string;
  pill: Pill;
  /** "1 review due", or null. */
  due: string | null;
};

const PLAN_ENDED: Pill = {
  text: "Plan ended · final review due",
  tone: "accent",
};

/** A list row's line 3 and line 4, from the design's state table. */
export function row(o: ObjectiveSummary, today: string): Row {
  const phase = phaseOf(o, today);
  const { total: days, n } = dayOf(o, today);
  const due =
    o.reviews_due > 0
      ? `${o.reviews_due} review${o.reviews_due === 1 ? "" : "s"} due`
      : null;
  const progress =
    phase === "completed"
      ? 100
      : phase === "later"
        ? 0
        : Math.round((n / days) * 100);
  const dayN = `Day ${n} of ${days}`;
  switch (phase) {
    case "paused":
      return {
        progress,
        when: dayN,
        pill: { text: "Paused", tone: "risk" },
        due,
      };
    case "terminated":
      return {
        progress,
        when: `Ended ${shortDay(o.status_since)}`,
        pill: { text: "Terminated", tone: "behind" },
        due,
      };
    case "completed":
      return {
        progress,
        when: `${MONTHS[new Date(parseIso(o.start_date)).getUTCMonth()]} – ${
          MONTHS[new Date(parseIso(o.end_date)).getUTCMonth()]
        } · ${Math.round(days / 7)} weeks`,
        pill: completedPill(o),
        due,
      };
    case "later":
      return {
        progress,
        when: `Starts ${dayLabel(o.start_date, today)}`,
        pill: { text: "Not started", tone: "neutral" },
        due,
      };
    case "planEnded":
      return {
        progress,
        when: `Ended ${dayLabel(o.end_date, today)}`,
        pill: PLAN_ENDED,
        due,
      };
    case "running":
      return {
        progress,
        when: dayN,
        pill: o.track
          ? (() => {
              const w = trackWords(o.track);
              return {
                text: `${o.figures_to_date.adherence_pct}% · ${w.pill}`,
                tone: w.tone,
              };
            })()
          : { text: `Day ${n} · no score yet`, tone: "neutral" },
        due,
      };
  }
}

const completedPill = (o: ObjectiveSummary): Pill => ({
  text: `Completed · ${o.figures.adherence_pct}%`,
  tone: "ok",
});

/** The pill on the detail's head. */
export function headPill(o: ObjectiveSummary, today: string): Pill {
  switch (phaseOf(o, today)) {
    case "paused":
      return { text: `Paused since ${shortDay(o.status_since)}`, tone: "risk" };
    case "terminated":
      return { text: `Terminated ${shortDay(o.status_since)}`, tone: "behind" };
    case "completed":
      return completedPill(o);
    case "later":
      return {
        text: `Starts ${dayLabel(o.start_date, today)}`,
        tone: "neutral",
      };
    case "planEnded":
      return PLAN_ENDED;
    case "running": {
      const { total: days, n } = dayOf(o, today);
      return { text: `Active · Day ${n} of ${days}`, tone: "accent" };
    }
  }
}

// ---------- Overview ----------

export type Tile = { label: string; value: string; hint?: string };

export type SoFar =
  | { kind: "waiting"; text: string }
  | {
      kind: "figures";
      heading: "So far" | "The whole plan";
      range: string;
      ring: { pct: number; tone: Tone };
      tiles: Tile[];
    };

/**
 * So far, or The whole plan once it has ended: the figures to date, or the
 * whole run's. Before the first day has passed, a line instead.
 */
export function soFar(o: ObjectiveSummary, today: string): SoFar {
  if (
    o.start_date >= today &&
    o.status !== "completed" &&
    o.status !== "ended"
  ) {
    return {
      kind: "waiting",
      text: `${
        o.start_date === today
          ? "It started today."
          : `It starts ${dayLabel(o.start_date, today)}.`
      } Numbers appear once the first day has passed.`,
    };
  }
  const ended =
    o.status === "completed" || o.status === "ended" || o.end_date < today;
  const last =
    o.status === "ended" ? o.status_since : ended ? o.end_date : today;
  const to = last < o.end_date ? last : o.end_date;
  const f: Figures = ended ? o.figures : o.figures_to_date;
  const days = daysBetween(o.start_date, o.end_date) + 1;
  return {
    kind: "figures",
    heading: ended ? "The whole plan" : "So far",
    range: `${dayLabel(o.start_date, today)} – ${dayLabel(to, today)} · ${
      daysBetween(o.start_date, to) + 1
    } of ${days} days`,
    ring: {
      pct: f.adherence_pct,
      tone: o.track ? trackWords(o.track).tone : "neutral",
    },
    tiles: [
      {
        label: "Logged effort",
        value: total(f.logged_minutes),
        hint: `of ${total(f.target_minutes)} planned`,
      },
      {
        label: "Targets met",
        value: `${f.target_met_days ?? 0} of ${f.planned_days ?? 0}`,
        hint: "planned days",
      },
      // Time only: the API counts the minutes, not the days (Rohit, I-11).
      {
        label: "Unplanned day effort",
        value: total(f.extra_off_day_minutes ?? 0),
      },
    ],
  };
}

export type Banner = {
  tone: Tone;
  title: string;
  /** The reason given, word for word. */
  quote: string | null;
  note: string | null;
};

/** The latest event of a kind, for its reason. */
const latest = (o: Objective, change: string) =>
  [...o.status_history].reverse().find((e) => e.change === change);

/** The state banner: paused, terminated or completed; none otherwise. */
export function banner(o: Objective, today: string): Banner | null {
  const since = dayLabel(o.status_since, today);
  switch (o.status) {
    case "paused":
      return {
        tone: "risk",
        title: `Paused since ${since}`,
        quote: latest(o, "paused")?.reason ?? null,
        note: `The end date stays ${dayLabel(o.end_date, today)}. Paused days are not planned and not made up.`,
      };
    case "ended":
      return {
        tone: "behind",
        title: `Terminated ${since}`,
        quote: latest(o, "ended")?.reason ?? null,
        note: null,
      };
    case "completed":
      return {
        tone: "ok",
        title: `Completed ${since} at the final review`,
        quote: null,
        note: null,
      };
    case "active":
      return null;
  }
}

/** The footer's words; its actions come with a later intent. */
export function footerLine(status: ObjectiveStatus): string {
  switch (status) {
    case "active":
      return "Schedule and target are fixed. They change only when you extend at the final review.";
    case "paused":
      return "Resume to plan days again. Terminating can't be undone.";
    case "completed":
    case "ended":
      return "This status is final. You can keep adding notes.";
  }
}

export type HistoryRow = {
  date: string;
  dot: "created" | "active" | "paused" | "terminated" | "completed";
  label: string;
  text: string | null;
};

const VERDICT = {
  met: "met",
  partly_met: "partly met",
  not_met: "not met",
} as const;

/** "30 days", or "4 weeks" when the days divide by seven. */
const runLength = (days: number) =>
  days % 7 === 0
    ? `${days / 7} week${days === 7 ? "" : "s"}`
    : `${days} day${days === 1 ? "" : "s"}`;

/**
 * Status history, newest first. The recorded events and extensions as the
 * API merged them, plus the day it started, once that day has come.
 */
export function history(o: Objective, today: string): HistoryRow[] {
  const first = o.segments[0];
  const cadence = o.review_cadence ? ` with ${o.review_cadence} reviews` : "";
  const started: HistoryRow = {
    date: o.start_date,
    dot: "active",
    label: "Active",
    text: `Started. Planned till ${dayLabel(first.end_date, today)}${cadence}.`,
  };
  const rows: HistoryRow[] = [];
  let pending = o.start_date <= today;
  for (const e of o.status_history) {
    if (pending && e.occurred_on > o.start_date) {
      rows.push(started);
      pending = false;
    }
    rows.push(eventRow(o, e, today));
  }
  if (pending) rows.push(started);
  return rows.reverse();
}

function eventRow(
  o: Objective,
  e: Objective["status_history"][number],
  today: string,
): HistoryRow {
  const reason = e.reason ?? null;
  switch (e.change) {
    case "created": {
      const first = o.segments[0];
      const days = daysBetween(first.start_date, first.end_date) + 1;
      return {
        date: e.occurred_on,
        dot: "created",
        label: "Created",
        text: `${o.from_parking_lot ? "From a parked idea. " : ""}${scheduleLine(
          first.schedule,
          duration,
        )} · ${runLength(days)}.`,
      };
    }
    case "paused":
      return {
        date: e.occurred_on,
        dot: "paused",
        label: "Paused",
        text: reason,
      };
    case "resumed":
      return {
        date: e.occurred_on,
        dot: "active",
        label: "Resumed",
        text: reason,
      };
    case "ended":
      return {
        date: e.occurred_on,
        dot: "terminated",
        label: "Terminated",
        text: reason,
      };
    case "completed":
      return {
        date: e.occurred_on,
        dot: "completed",
        label: "Completed",
        text: `Completed at the final review.${
          o.criteria_verdict
            ? ` Success criteria: ${VERDICT[o.criteria_verdict]}.`
            : ""
        }`,
      };
    case "extended": {
      const segment = o.segments.find(
        (s) => s.seq > 0 && s.start_date === e.occurred_on,
      );
      const plan = segment
        ? ` ${scheduleLine(segment.schedule, duration)}${
            o.review_cadence ? ` · ${o.review_cadence} reviews` : ""
          }.`
        : "";
      return {
        date: e.occurred_on,
        dot: "active",
        label: "Extended",
        text: `Extended at the final review, now planned till ${dayLabel(
          e.new_end_date ?? o.end_date,
          today,
        )}.${plan}`,
      };
    }
  }
}
