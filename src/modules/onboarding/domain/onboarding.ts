import type { Objective } from "@/shared/contract";
import {
  DEFAULT_DRAFT,
  dayLabel,
  duration,
  type Draft,
} from "@/modules/objectives/domain/newObjective";
import { parseIso } from "@/modules/objectives/domain/generateSlots";
import { planLine } from "@/modules/objectives/domain/objectiveView";

/**
 * Onboarding's rules (`docs/design/screens/02-auth-and-onboarding.md`),
 * pure: when it opens (G11, decided in I-10), the skip a browser remembers,
 * step 2's defaults, and what step 3 says about the objective just created.
 * Step 3 reads the objective the server returned, the first review
 * included (G34); nothing here works out a date the server already has.
 */

/** Step 2's defaults: every day, 0 h 45 m, starts today, 4 weeks, weekly. */
export const ONBOARDING_DRAFT: Draft = {
  ...DEFAULT_DRAFT,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  hours: "0",
  minutes: "45",
  start: "today",
  length: "4",
  unit: "weeks",
  cadence: "weekly",
};

/**
 * Whether onboarding opens instead of Today: no objective in any status,
 * and no skip by this account in this browser. A count the page couldn't
 * read is "unknown", and never opens it, so a failed read shows Today
 * rather than sending anyone round in a loop.
 */
export function opens({
  objectives,
  skipped,
}: {
  objectives: number | "unknown";
  skipped: boolean;
}): boolean {
  return objectives === 0 && !skipped;
}

/**
 * The cookie that remembers a skip, in that browser: the ids of the
 * accounts that skipped there, newest first, so another account on the
 * same browser is still onboarded.
 */
export const SKIP_COOKIE = "keel_onboarding_skipped";

/** How many accounts one browser remembers; the oldest drops off. */
export const SKIP_MAX_ACCOUNTS = 20;

/** A year, as the theme's cookie keeps its choice. */
const SKIP_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const ID = /^[A-Za-z0-9-]{1,64}$/;

/** The ids a cookie value holds; anything malformed holds none. */
function idsIn(value: string | undefined): string[] {
  if (!value) return [];
  const ids = value.split(".");
  return ids.every((id) => ID.test(id)) ? ids : [];
}

/** Whether this account skipped onboarding in this browser. */
export function skippedBy(value: string | undefined, userId: string): boolean {
  return idsIn(value).includes(userId);
}

/** The `document.cookie` string that adds this account's skip. */
export function skipCookie(
  value: string | undefined,
  userId: string,
  secure: boolean,
): string {
  const ids = [userId, ...idsIn(value).filter((id) => id !== userId)].slice(
    0,
    SKIP_MAX_ACCOUNTS,
  );
  return [
    `${SKIP_COOKIE}=${ids.join(".")}`,
    "Path=/",
    `Max-Age=${SKIP_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

const DAY_MS = 86_400_000;
/** 1 = Monday … 7 = Sunday. */
const isoWeekday = (date: string) => new Date(parseIso(date)).getUTCDay() || 7;

/** What step 3 reads from the created objective. */
export type Created = Pick<
  Objective,
  "title" | "schedule" | "start_date" | "end_date" | "upcoming_review_on"
> & { review_cadence?: "weekly" | "monthly" };

export type Tile = { label: string; value: string };

export type FirstObjective = {
  /** "today", or the day it starts: "Sun 6 Sep". */
  starts: string;
  /** "Fixed · Every day · 45m a day · weekly reviews · Sat 5 Sep – Fri 2 Oct". */
  plan: string;
  tiles: [Tile, Tile, Tile];
};

/** Step 3, "You're set", for the objective the server just created. */
export function firstObjective(o: Created, today: string): FirstObjective {
  const weekdays = o.schedule.planned_weekdays ?? [];
  const perDay = duration(o.schedule.minutes_per_planned_day);
  const startsToday = o.start_date === today;
  const days = (parseIso(o.end_date) - parseIso(o.start_date)) / DAY_MS + 1;
  // The same line as the objective's own page (I-11).
  const plan = planLine(o, today);
  return {
    starts: startsToday ? "today" : dayLabel(o.start_date, today),
    plan,
    tiles: [
      startsToday
        ? { label: "Today", value: `Day 1 of ${days}` }
        : { label: "Starts", value: dayLabel(o.start_date, today) },
      // Before the plan starts, "today" has nothing planned in it; the
      // tile says what a planned day asks instead.
      startsToday
        ? {
            label: "Planned today",
            value: weekdays.includes(isoWeekday(today)) ? perDay : "Off day",
          }
        : { label: "Planned a day", value: perDay },
      {
        label: "First review",
        value: o.upcoming_review_on
          ? dayLabel(o.upcoming_review_on, today)
          : "—",
      },
    ],
  };
}
