import {
  addMonths,
  reviewWindows,
  type Cadence,
} from "@/modules/reviews/domain/reviewWindows";
import { generateSlots, parseIso, toIso } from "./generateSlots";
import type { NewSchedule } from "./validateObjectiveWrite";

/**
 * The New objective page's rules (`docs/design/screens/04-objectives.md`),
 * pure: the Start choices, how long *n* weeks or months runs, the preview,
 * and the checks in the design's words. v1 plans fixed objectives only
 * (I-09); flexible comes back in v2, on the calendar week. The preview's
 * numbers come from the rules the server uses — `generateSlots` for planned
 * days, `reviewWindows` for the reviews — so the page shows what Create
 * would store. A draft that passes `checkDraft` is one
 * `validateObjectiveWrite` accepts.
 */

/** The design's text limits; the contract keeps its own, longer ones. */
export const NAME_MAX = 80;
export const TEXT_MAX = 280;

/** A daily target's bounds, in minutes ("under 16 hours"). */
const MIN_PER_DAY = 15;
const MAX_PER_DAY = 16 * 60;

/** "A year or less". */
const MAX_WEEKS = 52;
const MAX_MONTHS = 12;

export type StartChoice = "today" | "tomorrow" | "monday";
export type LengthUnit = "weeks" | "months";

/** The form as typed: text fields as entered, numbers as the digits typed. */
export type Draft = {
  name: string;
  why: string;
  criteria: string;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  hours: string;
  minutes: string;
  start: StartChoice;
  length: string;
  unit: LengthUnit;
  cadence: Cadence;
};

/** The fields a check can fail, in page order. */
export const FIELDS = [
  "name",
  "why",
  "criteria",
  "days",
  "target",
  "length",
] as const;
export type Field = (typeof FIELDS)[number];

/** The prototype's defaults. */
export const DEFAULT_DRAFT: Draft = {
  name: "",
  why: "",
  criteria: "",
  weekdays: [1, 2, 3, 4, 5],
  hours: "1",
  minutes: "00",
  start: "tomorrow",
  length: "4",
  unit: "weeks",
  cadence: "weekly",
};

const DAY_MS = 86_400_000;
const addDays = (date: string, n: number) => toIso(parseIso(date) + n * DAY_MS);
const daysFrom = (a: string, b: string) => (parseIso(b) - parseIso(a)) / DAY_MS;

/** 1 = Monday … 7 = Sunday. */
const isoWeekday = (date: string) => new Date(parseIso(date)).getUTCDay() || 7;

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

/** "Sun 6 Sep", with the year when it isn't today's: "Tue 5 Jan 2027". */
export function dayLabel(date: string, today: string): string {
  const d = new Date(parseIso(date));
  const year = d.getUTCFullYear();
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${
    String(year) === today.slice(0, 4) ? "" : ` ${year}`
  }`;
}

/** "45m", or "2h 06m". */
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** Today, tomorrow, and next Monday — on a Monday, the Monday after. */
export function startChoices(today: string): Record<StartChoice, string> {
  return {
    today,
    tomorrow: addDays(today, 1),
    monday: addDays(today, 8 - isoWeekday(today)),
  };
}

/**
 * How many days *n* weeks or months runs from `start`, inclusive. Months end
 * the day before the same date *n* months on, with the month-end clamping of
 * monthly reviews: from 5 Sep, 1 month ends 4 Oct; from 31 Jan, 27 Feb.
 */
export function runsForDays(
  start: string,
  n: number,
  unit: LengthUnit,
): number {
  return unit === "weeks" ? n * 7 : daysFrom(start, addMonths(start, n));
}

/** Digits typed into a number field; anything else reads as 0. */
const digits = (s: string): number => (/^\d+$/.test(s) ? Number(s) : 0);

const targetOf = (d: Draft) => digits(d.hours) * 60 + digits(d.minutes);

/** The length typed, or 1 while it is empty or 0, so the preview still reads. */
const lengthOf = (d: Draft) => Math.max(1, digits(d.length));

export type Preview = {
  startsOn: string;
  endsOn: string;
  /** "ends Sat 3 Oct". */
  endLabel: string;
  /** "A review is due at the end of each week. The last one, on …". */
  reviewHint: string;
  plannedDays: number;
  /** The week the plan really makes, or "—" with no target yet. */
  eachWeek: string;
  reviews: number;
};

/** What the plan card shows for the draft as it stands. */
export function preview(draft: Draft, today: string): Preview {
  const startsOn = startChoices(today)[draft.start];
  const endsOn = addDays(
    startsOn,
    runsForDays(startsOn, lengthOf(draft), draft.unit) - 1,
  );
  const target = targetOf(draft);
  const week = target * draft.weekdays.length;
  const plannedDays = generateSlots({
    scheduleMode: "fixed",
    plannedWeekdays: draft.weekdays,
    minutesPerPlannedDay: target,
    startDate: startsOn,
    endDate: endsOn,
  }).length;
  const end = dayLabel(endsOn, today);
  return {
    startsOn,
    endsOn,
    endLabel: `ends ${end}`,
    reviewHint: `A review is due at the end of each ${
      draft.cadence === "weekly" ? "week" : "month"
    }. The last one, on ${end}, looks at the whole plan.`,
    plannedDays,
    eachWeek: week > 0 ? duration(week) : "—",
    reviews: reviewWindows(draft.cadence, {
      id: "new",
      start_date: startsOn,
      end_date: endsOn,
    }).length,
  };
}

/** The body `POST /v1/objectives` takes, as this page sends it. */
export type ObjectiveBody = {
  title: string;
  why_now: string;
  success_criteria: string;
  schedule: NewSchedule;
  starts_on: string;
  tz: string;
  runs_for_days: number;
  review_cadence: Cadence;
};

export type Checked =
  | { ok: true; body: ObjectiveBody }
  | { ok: false; errors: Partial<Record<Field, string>>; first: Field };

function targetError(d: Draft): string | null {
  const t = targetOf(d);
  if (t === 0) return "Set a target above zero.";
  if (digits(d.minutes) > 59) return "Minutes go up to 59.";
  if (t < MIN_PER_DAY) return "Set at least 15 minutes a day.";
  if (t > MAX_PER_DAY) return "Keep a daily target under 16 hours.";
  return null;
}

function lengthError(d: Draft): string | null {
  const n = digits(d.length);
  if (n < 1) return "Enter how long it runs.";
  return n > (d.unit === "weeks" ? MAX_WEEKS : MAX_MONTHS)
    ? "Keep it to a year or less."
    : null;
}

/**
 * Every check in the design's list, in its words and page order — or, when
 * all pass, the body to send. `today` and `tz` are the browser's (NFR-12).
 */
export function checkDraft(draft: Draft, today: string, tz: string): Checked {
  const found: Record<Field, string | null> = {
    name: draft.name.trim() ? null : "Name the objective.",
    why: draft.why.trim()
      ? null
      : "Say why it matters. You'll read it again at review.",
    criteria: draft.criteria.trim() ? null : "Say what would prove it worked.",
    days: draft.weekdays.length === 0 ? "Pick at least one day." : null,
    target: targetError(draft),
    length: lengthError(draft),
  };
  const errors: Partial<Record<Field, string>> = {};
  for (const f of FIELDS) {
    const message = found[f];
    if (message) errors[f] = message;
  }
  const first = FIELDS.find((f) => errors[f]);
  if (first) return { ok: false, errors, first };

  const startsOn = startChoices(today)[draft.start];
  const target = targetOf(draft);
  return {
    ok: true,
    body: {
      title: draft.name.trim(),
      why_now: draft.why.trim(),
      success_criteria: draft.criteria.trim(),
      schedule: {
        mode: "fixed",
        planned_weekdays: [...draft.weekdays].sort((a, b) => a - b),
        minutes_per_planned_day: target,
      },
      starts_on: startsOn,
      tz,
      runs_for_days: runsForDays(startsOn, digits(draft.length), draft.unit),
      review_cadence: draft.cadence,
    },
  };
}

/** The toast after Create: "… It starts today." or "… It starts Sun 6 Sep." */
export function createdMessage(startsOn: string, today: string): string {
  return startsOn === today
    ? "Objective created. It starts today."
    : `Objective created. It starts ${dayLabel(startsOn, today)}.`;
}
