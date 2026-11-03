import type {
  Deviation,
  DueReview,
  ImprovementAnswer,
  Review,
  ReviewKind,
  ReviewSummary,
  Schedule,
  ScheduleDay,
} from "@/shared/contract";
import { mondayOf } from "@/modules/effort/domain/effortMonth";
import { trackOf } from "@/modules/effort/domain/track";
import {
  datesBetween,
  parseIso,
  toIso,
} from "@/modules/objectives/domain/generateSlots";
import { dayLabel, duration } from "@/modules/objectives/domain/newObjective";
import {
  scheduleLine,
  type Tone,
} from "@/modules/objectives/domain/objectiveView";
import { compact, total, trackWords } from "@/modules/today/domain/todayView";
import { localDayOf, localTimeOf } from "@/shared/time/localDay";

/**
 * Every place that shows a review (`docs/design/screens/05-reviews.md`):
 * the Reviews tab, the due banner, the weekly or monthly review and the saved
 * review — pure. Which reviews are due, their labels and periods are the
 * API's (G19); the figures are the API's (G21), the bars the schedule grid's.
 * Nothing here decides a window (I-13).
 */

// ---------- Words shared by every place ----------

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

const utc = (date: string) => new Date(parseIso(date));
const weekdayOf = (date: string) => WEEKDAYS[utc(date).getUTCDay()];

/** "Mon 24 – Sun 30 Aug" within a month; "Mon 31 Aug – Sun 6 Sep" across one. */
export function periodRange(from: string, to: string, today: string): string {
  if (from === to) return dayLabel(from, today);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const start = sameMonth
    ? `${weekdayOf(from)} ${utc(from).getUTCDate()}`
    : dayLabel(from, today);
  return `${start} – ${dayLabel(to, today)}`;
}

/** An instant in the user's zone: "5 Sep, 18:40", or "Sun 30 Aug, 19:10" with the weekday. */
export function stamp(
  instant: string,
  tz: string,
  today: string,
  withWeekday = false,
): string {
  const at = new Date(instant);
  const day = dayLabel(localDayOf(at, tz), today);
  return `${withWeekday ? day : day.slice(4)}, ${localTimeOf(at, tz)}`;
}

/** "Week 2 review", "Month 1 review", or "Final review". */
export const titleOf = (r: { kind: ReviewKind; label: string }): string =>
  r.kind === "plan_end" ? "Final review" : `${r.label} review`;

/** "Week 1", or "Final review": a review's name on its own. */
const nameOf = (r: { kind: ReviewKind; label: string }): string =>
  r.kind === "plan_end" ? "Final review" : r.label;

/** "week 1", "month 2", "final": the label inside a sentence. */
const inSentence = (r: { kind: ReviewKind; label: string }): string =>
  r.kind === "plan_end" ? "final" : r.label.toLowerCase();

/** "week" or "month": "The week in numbers", "this week". */
export const unitOf = (kind: ReviewKind): "week" | "month" =>
  kind === "monthly" ? "month" : "week";

/** The adherence band's colour (adherence.md, *Track*), or none without a figure. */
export function adherenceTone(pct: number | null): Tone {
  if (pct === null) return "neutral";
  const band = trackOf({ adherence_pct: pct }, true);
  return trackWords(band as NonNullable<typeof band>).tone;
}

export const IMPROVEMENT: Record<ImprovementAnswer, string> = {
  yes: "Worked",
  partly: "Partly",
  no: "Didn't work",
  not_tried: "Didn't try it",
};
/** The answers in the order the design lists them (G6). */
export const IMPROVEMENT_ORDER: readonly ImprovementAnswer[] = [
  "yes",
  "partly",
  "no",
  "not_tried",
];
export const IMPROVEMENT_TONE: Record<ImprovementAnswer, Tone> = {
  yes: "ok",
  partly: "risk",
  no: "behind",
  not_tried: "neutral",
};

export type Verdict = NonNullable<Deviation["verdict"]>;
export const VERDICT: Record<Verdict, string> = {
  worth_it: "It held",
  not_worth_it: "It didn't hold",
};
export const VERDICT_ORDER: readonly Verdict[] = ["worth_it", "not_worth_it"];

/** The four cards' titles, as asked (a draft) or as answered (saved). */
export function cardTitles(
  kind: ReviewKind,
  saved: boolean,
): { numbers: string; change: string; chosen: string; reflect: string } {
  const unit = unitOf(kind);
  return {
    numbers: `The ${unit} in numbers`,
    change: saved ? `Last ${unit}'s change` : `Did last ${unit}'s change work?`,
    chosen: "Chosen deviations",
    reflect: "Reflect",
  };
}

/** Under the quoted change: which review set it. */
export function changeSetIn(
  previous: { kind: ReviewKind; label: string } | null,
  saved: boolean,
): string {
  const where = previous
    ? `the ${inSentence(previous)} review`
    : "your last review";
  return saved ? `Set in ${where}` : `The change you set in ${where}`;
}

/** Card 2 with no change to check: asked, or answered. */
export const nothingToCheck = (saved: boolean): string =>
  `First review of this objective, so there ${saved ? "was" : "is"} no earlier change to check.`;

// ---------- The Reviews tab and the banner ----------

export type DueAction =
  | { kind: "start" }
  | { kind: "continue"; reviewId: string }
  | { kind: "wait"; text: string }
  | { kind: "later"; text: string };

/** A final review is due, but opens with its own intent (Rohit, 2026-11-02). */
export const FINAL_LATER = "Opens in a later release.";

export type DueCard = {
  key: string;
  title: string;
  period: string;
  /** "Draft saved", when the draft has been written. */
  draft: boolean;
  /** "· last edited 5 Sep, 18:40". */
  edited: string | null;
  action: DueAction;
};

/** The draft written for a due window, if one has been. */
function writtenDraft(
  d: DueReview,
  reviews: readonly ReviewSummary[],
): ReviewSummary | null {
  if (d.review_id === null) return null;
  const r = reviews.find((x) => x.id === d.review_id);
  return r && r.last_saved_at !== null ? r : null;
}

function actionOf(
  d: DueReview,
  i: number,
  first: DueReview,
  draft: ReviewSummary | null,
): DueAction {
  if (i > 0) return { kind: "wait", text: `Opens after ${first.label}` };
  if (d.kind === "plan_end") return { kind: "later", text: FINAL_LATER };
  return draft ? { kind: "continue", reviewId: draft.id } : { kind: "start" };
}

/** "The whole plan · ended Fri 4 Sep", or the window's own dates. */
const duePeriod = (d: DueReview, today: string) =>
  d.kind === "plan_end"
    ? `The whole plan · ended ${dayLabel(d.period_end, today)}`
    : periodRange(d.period_start, d.period_end, today);

/** One card per due review, oldest first; only the first can be opened. */
export function dueCards(
  due: readonly DueReview[],
  reviews: readonly ReviewSummary[],
  tz: string,
  today: string,
): DueCard[] {
  return due.map((d, i) => {
    const draft = writtenDraft(d, reviews);
    return {
      key: `${d.period_start}/${d.period_end}`,
      title: titleOf(d),
      period: duePeriod(d, today),
      draft: draft !== null,
      edited: draft
        ? `last edited ${stamp(draft.last_saved_at as string, tz, today)}`
        : null,
      action: actionOf(d, i, due[0], draft),
    };
  });
}

export type Banner = { title: string; sub: string; action: DueAction };

/** The Overview's banner, when a review is due: it opens the oldest. */
export function dueBanner(
  due: readonly DueReview[],
  reviews: readonly ReviewSummary[],
  today: string,
): Banner | null {
  if (due.length === 0) return null;
  const d = due[0];
  const draft = writtenDraft(d, reviews);
  const n = due.length;
  return {
    title: `${titleOf(d)} is due`,
    sub: [
      `${n} review${n === 1 ? "" : "s"} due`,
      ...(draft ? ["draft saved"] : []),
      ...(d.kind === "plan_end"
        ? [`the plan ended ${dayLabel(d.period_end, today)}`]
        : []),
    ].join(" · "),
    action: actionOf(d, 0, d, draft),
  };
}

/** The tab's label count: saved reviews only. */
export const tabCount = (reviews: readonly ReviewSummary[]): number =>
  reviews.filter((r) => r.status === "saved").length;

/** Nothing due and nothing saved. */
export const emptyLine = (upcoming: string | null, today: string): string =>
  upcoming
    ? `No reviews yet. The first one is due ${dayLabel(upcoming, today)}.`
    : "No reviews yet.";

const OUTCOME: Record<NonNullable<ReviewSummary["outcome"]>, string> = {
  continued: "extended",
  completed: "completed",
  paused: "paused",
  ended: "terminated",
};

export type SavedRow = {
  id: string;
  title: string;
  final: boolean;
  sub: string | null;
  pct: number | null;
  /** "84%", or "—" without a figure. */
  pctText: string;
  tone: Tone;
  saved: string;
};

export type SavedList = {
  count: number;
  /** Month headings appear once there are more than 8. */
  groups: { heading: string | null; rows: SavedRow[] }[];
  /** How many rows "Show n earlier reviews" would add; 0 when all show. */
  hidden: number;
};

export const SHOWN_SAVED = 8;

function savedRow(r: ReviewSummary, tz: string, today: string): SavedRow {
  const final = r.kind === "plan_end";
  return {
    id: r.id,
    title: final
      ? "Final review · whole plan"
      : `${r.label} · ${periodRange(r.period_start, r.period_end, today)}`,
    final,
    sub:
      final && r.outcome
        ? `Outcome: ${OUTCOME[r.outcome]}`
        : r.what_changes_next
          ? `Change: “${r.what_changes_next}”`
          : null,
    pct: r.adherence_pct,
    pctText: r.adherence_pct === null ? "—" : `${r.adherence_pct}%`,
    tone: adherenceTone(r.adherence_pct),
    saved: dayLabel(
      localDayOf(new Date(r.saved_at as string), tz),
      today,
    ).slice(4),
  };
}

const monthHeading = (date: string, today: string) =>
  `${MONTHS[utc(date).getUTCMonth()]}${
    date.slice(0, 4) === today.slice(0, 4) ? "" : ` ${date.slice(0, 4)}`
  }`;

/**
 * Saved reviews, newest first. More than 8: grouped under month headings,
 * the newest 8 shown until **Show n earlier reviews**.
 */
export function savedList(
  reviews: readonly ReviewSummary[],
  tz: string,
  today: string,
  showAll: boolean,
): SavedList {
  const saved = reviews
    .filter((r) => r.status === "saved")
    .sort((a, b) => b.period_start.localeCompare(a.period_start));
  const many = saved.length > SHOWN_SAVED;
  const shown = many && !showAll ? saved.slice(0, SHOWN_SAVED) : saved;
  const groups: SavedList["groups"] = [];
  for (const r of shown) {
    const heading = many ? monthHeading(r.period_end, today) : null;
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) {
      last.rows.push(savedRow(r, tz, today));
    } else {
      groups.push({ heading, rows: [savedRow(r, tz, today)] });
    }
  }
  return {
    count: saved.length,
    groups,
    hidden: saved.length - shown.length,
  };
}

// ---------- The review page ----------

export type Head = {
  title: string;
  sub: string;
  pill: { text: string; tone: Tone };
};

/** The page's title, its sub-line and its pill. */
export function reviewHead(
  r: Review,
  o: { title: string; schedule: Schedule; start_date: string },
  tz: string,
  today: string,
): Head {
  const saved = r.status === "saved";
  // A final review covers the whole plan (G22), from the objective's start.
  const final = r.kind === "plan_end";
  return {
    title: titleOf(r),
    sub: [
      periodRange(final ? o.start_date : r.period_start, r.period_end, today),
      ...(final ? ["the whole plan"] : []),
      o.title,
      ...(saved ? [scheduleLine(o.schedule)] : []),
    ].join(" · "),
    pill: saved
      ? {
          text: `Saved ${stamp(r.saved_at as string, tz, today, true)}`,
          tone: "neutral",
        }
      : r.last_saved_at
        ? {
            text: `Draft saved · ${stamp(r.last_saved_at, tz, today)}`,
            tone: "neutral",
          }
        : { text: `Due ${dayLabel(r.period_end, today)}`, tone: "accent" },
  };
}

/** "Draft saved · 5 Sep, 18:40" after an autosave. */
export const draftPill = (lastSavedAt: string, tz: string, today: string) =>
  `Draft saved · ${stamp(lastSavedAt, tz, today)}`;

export type Tile = {
  label: string;
  value: string;
  hint: string | null;
  tone: Tone | "deviation" | null;
};

const deviationMinutes = (r: Pick<Review, "deviations">) =>
  r.deviations.reduce((sum, d) => sum + d.minutes, 0);

/**
 * The five tiles. Each but Logged compares with the previous **saved**
 * review, named in the card's hint; without one, no comparison (I-13).
 */
export function tiles(
  r: Review,
  previous: Review | null,
): { hint: string | null; tiles: Tile[] } {
  const f = r.figures;
  const p = previous?.figures;
  const was = previous ? ` in ${inSentence(previous)}` : "";
  const over = f.over_target_minutes ?? 0;
  const dev = deviationMinutes(r);
  return {
    hint: previous ? `${previous.label} for comparison` : null,
    tiles: [
      {
        label: "Adherence",
        value: `${f.adherence_pct}%`,
        hint: p ? `${p.adherence_pct}%${was}` : null,
        tone: adherenceTone(f.adherence_pct),
      },
      {
        label: "Logged",
        value: total(f.logged_minutes),
        hint: `of ${total(f.target_minutes)} planned${
          over > 0 ? ` · +${compact(over)} over` : ""
        }`,
        tone: null,
      },
      {
        label: "Targets met",
        value: `${f.target_met_days ?? 0} of ${f.planned_days ?? 0}`,
        hint: p
          ? `${p.target_met_days ?? 0} of ${p.planned_days ?? 0}${was}`
          : null,
        tone: null,
      },
      {
        label: "Deviation time",
        value: total(dev),
        hint: previous ? `${total(deviationMinutes(previous))}${was}` : null,
        tone: dev > 0 ? "deviation" : null,
      },
      {
        label: "Extra, off days",
        value: total(f.extra_off_day_minutes ?? 0),
        hint: p ? `${total(p.extra_off_day_minutes ?? 0)}${was}` : null,
        tone: null,
      },
    ],
  };
}

export type BarStyle = "met" | "short" | "missed" | "extra" | "off";

export type Bar = {
  date: string;
  /** "Sun 30". */
  day: string;
  /** On top: "2h", "45m", "0m", or "—" on an off day with nothing. */
  value: string;
  style: BarStyle;
  /** Pixels, out of BAR_MAX; the target line sits at BAR_TARGET. */
  height: number;
  /** Under it: ✓ Met · ✓ +30m · − 1h 15m · ✕ Missed · + Extra · Off day. */
  word: string;
  tone: Tone;
};

export const BAR_TARGET = 64;
export const BAR_MAX = 96;

/** The grid's day, or an off day with nothing logged when it lacks one. */
const dayIn = (grid: readonly ScheduleDay[], date: string): ScheduleDay =>
  grid.find((d) => d.date === date) ?? {
    date,
    state: "off_day",
    segment_id: "",
  };

function barOf(day: ScheduleDay, ref: number): Bar {
  const logged = day.logged_minutes ?? 0;
  const target = day.target_minutes ?? 0;
  const label = `${weekdayOf(day.date)} ${utc(day.date).getUTCDate()}`;
  const height =
    logged === 0
      ? 0
      : Math.max(4, Math.min(BAR_MAX, Math.round((logged / ref) * BAR_TARGET)));
  const base = { date: day.date, day: label, value: compact(logged), height };
  switch (day.state) {
    case "target_met":
      return {
        ...base,
        style: "met",
        word: logged > target ? `✓ +${compact(logged - target)}` : "✓ Met",
        tone: "ok",
      };
    case "worked_short":
      return {
        ...base,
        style: "short",
        word: `− ${compact(target - logged)}`,
        tone: "risk",
      };
    case "planned_no_log":
      return {
        ...base,
        style: "missed",
        height: 3,
        word: "✕ Missed",
        tone: "behind",
      };
    case "off_day_worked":
      return { ...base, style: "extra", word: "+ Extra", tone: "ok" };
    case "off_day":
      return {
        ...base,
        style: "off",
        value: "—",
        word: "Off day",
        tone: "neutral",
      };
  }
}

/**
 * A weekly review's bars: one per day of the period, from the schedule grid
 * — the Effort tab's days, states and targets. The dashed line is the
 * planned days' target; with none planned, an hour stands in for it.
 */
export function dayBars(
  grid: readonly ScheduleDay[],
  period: { period_start: string; period_end: string },
): { target: string | null; bars: Bar[]; label: string } {
  const days = datesBetween(period.period_start, period.period_end).map((d) =>
    dayIn(grid, d),
  );
  const planned = days.find((d) => (d.target_minutes ?? 0) > 0);
  const ref = planned ? (planned.target_minutes as number) : 60;
  const bars = days.map((d) => barOf(d, ref));
  return {
    target: planned ? compact(ref) : null,
    bars,
    label: bars
      .map((b) => `${b.day} ${b.value === "—" ? "0m" : b.value}, ${b.word}`)
      .join("; "),
  };
}

export type WeekLine = {
  range: string;
  logged: string;
  planned: string;
  /** The bar's width, logged against planned, capped at 100. */
  pct: number;
  tone: Tone;
};

/**
 * A monthly review's rows: each Monday-to-Sunday week, clipped to the
 * period, with its logged and planned time summed from the grid's days.
 */
export function monthWeeks(
  grid: readonly ScheduleDay[],
  period: { period_start: string; period_end: string },
  today: string,
): WeekLine[] {
  const out: WeekLine[] = [];
  let from = period.period_start;
  while (from <= period.period_end) {
    const sunday = toIso(parseIso(mondayOf(from)) + 6 * DAY_MS);
    const to = sunday < period.period_end ? sunday : period.period_end;
    let logged = 0;
    let planned = 0;
    for (const date of datesBetween(from, to)) {
      const d = dayIn(grid, date);
      logged += d.logged_minutes ?? 0;
      planned += d.target_minutes ?? 0;
    }
    out.push({
      range: periodRange(from, to, today),
      logged: total(logged),
      planned: total(planned),
      pct:
        planned === 0
          ? logged > 0
            ? 100
            : 0
          : Math.min(100, Math.round((logged / planned) * 100)),
      tone: planned === 0 ? "neutral" : logged >= planned ? "ok" : "risk",
    });
    from = toIso(parseIso(to) + DAY_MS);
  }
  return out;
}

export type ChosenBlock = {
  id: string;
  /** "Wed 2 Sep · 1h 30m". */
  when: string;
  what: string;
  reasoning: string;
  /** Judged by another review: its verdict, which this one can't change. */
  locked: Verdict | null;
  /** The verdict this review gave, as stored. */
  verdict: Verdict | null;
};

/**
 * Card 3: the period's Chosen deviations, each to be judged, and the hint
 * "1 Chosen · 0 Drifted this week". Drifted ones are counted, not judged.
 */
export function chosenCard(
  r: Pick<Review, "id" | "kind" | "deviations">,
  today: string,
): { hint: string; none: string; blocks: ChosenBlock[] } {
  const chosen = r.deviations.filter((d) => d.kind === "chosen");
  const drifted = r.deviations.length - chosen.length;
  const unit = unitOf(r.kind);
  return {
    hint: `${chosen.length} Chosen · ${drifted} Drifted this ${unit}`,
    none: `No Chosen deviations this ${unit}.`,
    blocks: [...chosen]
      .sort((a, b) => a.local_date.localeCompare(b.local_date))
      .map((d) => {
        const elsewhere =
          d.verdict_review_id !== null && d.verdict_review_id !== r.id;
        return {
          id: d.id,
          when: `${dayLabel(d.local_date, today)} · ${duration(d.minutes)}`,
          what: d.what_happened,
          reasoning: d.reasoning ?? "",
          locked: elsewhere ? d.verdict : null,
          verdict: elsewhere ? null : d.verdict,
        };
      }),
  };
}

// ---------- The saved review ----------

export type Neighbour =
  { kind: "link"; id: string; text: string } | { kind: "none"; text: string };

/** The next window after this one that is a draft, or due and unstarted. */
function nextOwed(
  r: Pick<Review, "period_end">,
  list: readonly ReviewSummary[],
  due: readonly DueReview[],
): { kind: ReviewKind; label: string; draft: boolean } | null {
  const of = (x: DueReview | ReviewSummary, draft: boolean) => ({
    start: x.period_start,
    kind: x.kind,
    label: x.label,
    draft,
  });
  const drafts = list
    .filter((x) => x.status === "draft" && x.period_start > r.period_end)
    .map((x) => of(x, true));
  const owed = due
    .filter((x) => x.review_id === null && x.period_start > r.period_end)
    .map((x) => of(x, false));
  const next = [...drafts, ...owed].sort((a, b) =>
    a.start.localeCompare(b.start),
  )[0];
  return next ?? null;
}

/** Previous and next saved reviews; a disabled one says why. */
export function neighbours(
  r: Pick<Review, "id" | "period_end">,
  list: readonly ReviewSummary[],
  due: readonly DueReview[],
): { previous: Neighbour; next: Neighbour } {
  const saved = list
    .filter((x) => x.status === "saved")
    .sort((a, b) => a.period_start.localeCompare(b.period_start));
  const i = saved.findIndex((x) => x.id === r.id);
  const before = i > 0 ? saved[i - 1] : null;
  const after = i >= 0 && i < saved.length - 1 ? saved[i + 1] : null;
  const owed = nextOwed(r, list, due);
  return {
    previous: before
      ? { kind: "link", id: before.id, text: nameOf(before) }
      : { kind: "none", text: "No earlier review" },
    next: after
      ? { kind: "link", id: after.id, text: nameOf(after) }
      : {
          kind: "none",
          text: owed
            ? `${nameOf(owed)} · ${owed.draft ? "still a draft" : "not saved yet"}`
            : "No later review",
        },
  };
}

/**
 * Under the change a saved review set: which review checked it, or will. The
 * next saved review answered it if it was saved after this one.
 */
export function checkedIn(
  r: Pick<Review, "id" | "period_end" | "saved_at">,
  list: readonly ReviewSummary[],
  due: readonly DueReview[],
): string {
  const later = list
    .filter(
      (x) =>
        x.status === "saved" &&
        x.period_start > r.period_end &&
        (x.saved_at as string) > (r.saved_at as string),
    )
    .sort((a, b) => a.period_start.localeCompare(b.period_start))[0];
  if (later) return `Checked in the ${inSentence(later)} review`;
  const owed = nextOwed(r, list, due);
  return owed
    ? `To check in the ${inSentence(owed)} review`
    : "To check at the next review.";
}
