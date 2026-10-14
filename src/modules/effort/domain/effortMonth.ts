import type { ProblemError } from "@/shared/contract";
import { err, ok, type Result } from "@/shared/result";
import {
  datesBetween,
  parseIso,
  toIso,
  type SegmentForSlots,
} from "@/modules/objectives/domain/generateSlots";
import {
  planSlots,
  type PlannedSlot,
} from "@/modules/objectives/domain/planSlots";
import type { StatusEventRow } from "@/modules/objectives/domain/statusTimeline";

/**
 * The Effort tab: every session against one objective, a month at a time
 * (ADR-001 domain: pure). Read off the Effort tab design:
 *
 * - **Rows.** One per entry, in the order they were done. A planned day of a
 *   fixed schedule with no entry gets a row of its own with `minutes: null`,
 *   up to and including today — a future day has not been missed yet.
 * - **vs target.** On a planned day, the day's total minus its target, shown
 *   on the day's first row; off-plan effort has no target, so null.
 * - **Weeks** start on Monday, as the contract numbers weekdays (1 = Monday),
 *   and hold only the month's days. `planned_days_worked` counts the fixed
 *   planned days in them, worked or not; a flexible schedule plans no
 *   particular day, so it says how many days were worked.
 * - **Totals** are the whole objective's — the figures above the month picker
 *   — not the month's.
 * - **Longest streak**: walking the planned slots in order, a planned day
 *   worked adds one and an unworked one ends the run; a flexible week that
 *   met its days adds the days worked, and one that fell short ends the run.
 *   Off days and paused days neither add nor break.
 *
 * Nothing here is stored (NFR-09).
 */

export type EffortEntryFact = {
  local_date: string;
  minutes: number;
  note: string;
};

export type EffortMonthDay = {
  date: string;
  planned: boolean;
  minutes: number | null;
  note: string | null;
  vs_target: number | null;
};

export type EffortMonth = {
  month: string;
  weeks: {
    week_start: string;
    days: EffortMonthDay[];
    subtotal_minutes: number;
    planned_days_worked: string;
  }[];
  totals: {
    logged_minutes: number;
    sessions: number;
    longest_streak_days: number;
    extra_off_day_minutes: number;
  };
};

/** `month` is a real calendar month written YYYY-MM. */
export function parseMonth(
  month: string | null,
): Result<{ first: string; last: string }, ProblemError[]> {
  const m = month === null ? null : /^(\d{4})-(\d{2})$/.exec(month);
  const mm = m ? Number(m[2]) : 0;
  if (!m || mm < 1 || mm > 12) {
    return err([{ field: "month", message: "Required; must be YYYY-MM." }]);
  }
  const first = `${m[1]}-${m[2]}-01`;
  const next =
    mm === 12
      ? `${Number(m[1]) + 1}-01-01`
      : `${m[1]}-${String(mm + 1).padStart(2, "0")}-01`;
  return ok({ first, last: toIso(parseIso(next) - 86_400_000) });
}

/** The Monday on or before `date`. */
export function mondayOf(date: string): string {
  const ms = parseIso(date);
  const dow = new Date(ms).getUTCDay(); // 0 = Sunday
  return toIso(ms - ((dow + 6) % 7) * 86_400_000);
}

function minutesByDate(entries: readonly EffortEntryFact[]) {
  const out = new Map<string, number>();
  for (const e of entries) {
    out.set(e.local_date, (out.get(e.local_date) ?? 0) + e.minutes);
  }
  return out;
}

export function longestStreak(
  slots: readonly PlannedSlot[],
  logged: ReadonlyMap<string, number>,
): number {
  let best = 0;
  let run = 0;
  for (const slot of slots) {
    if (slot.periodKind === "day") {
      run = logged.has(slot.periodStart) ? run + 1 : 0;
    } else {
      const worked = slot.activeDays.filter((d) => logged.has(d)).length;
      run = worked >= slot.targetDays ? run + worked : 0;
    }
    best = Math.max(best, run);
  }
  return best;
}

export function effortMonth(input: {
  month: string;
  range: { first: string; last: string };
  today: string;
  segments: readonly SegmentForSlots[];
  statusEvents: readonly StatusEventRow[];
  /** Every entry of the objective, in the order the sessions happened. */
  entries: readonly EffortEntryFact[];
}): EffortMonth {
  const { month, range, today, segments, statusEvents, entries } = input;
  const slots = planSlots(segments, statusEvents);
  const logged = minutesByDate(entries);

  const slotOn = new Map<string, PlannedSlot>();
  for (const s of slots) for (const d of s.activeDays) slotOn.set(d, s);
  const plannedDays = new Set(
    slots.filter((s) => s.periodKind === "day").map((s) => s.periodStart),
  );
  const flexible = segments.some((s) => s.scheduleMode === "flexible");

  const weeks = new Map<string, EffortMonth["weeks"][number]>();
  const weekOf = (date: string) => {
    const start = mondayOf(date);
    let w = weeks.get(start);
    if (!w) {
      w = {
        week_start: start,
        days: [],
        subtotal_minutes: 0,
        planned_days_worked: "",
      };
      weeks.set(start, w);
    }
    return w;
  };

  for (const date of datesBetween(range.first, range.last)) {
    const slot = slotOn.get(date);
    const onDay = entries.filter((e) => e.local_date === date);
    const target = slot ? slot.minutesPerDay : null;
    if (onDay.length === 0) {
      if (plannedDays.has(date) && date <= today) {
        weekOf(date).days.push({
          date,
          planned: true,
          minutes: null,
          note: null,
          vs_target: -(target as number),
        });
      }
      continue;
    }
    const w = weekOf(date);
    onDay.forEach((e, i) => {
      w.days.push({
        date,
        planned: slot !== undefined,
        minutes: e.minutes,
        note: e.note,
        vs_target:
          i === 0 && target !== null
            ? (logged.get(date) as number) - target
            : null,
      });
      w.subtotal_minutes += e.minutes;
    });
  }

  for (const w of weeks.values()) {
    const days = datesBetween(
      w.week_start,
      toIso(parseIso(w.week_start) + 6 * 86_400_000),
    ).filter((d) => d >= range.first && d <= range.last);
    const worked = days.filter((d) => logged.has(d));
    if (flexible) {
      w.planned_days_worked = `${worked.length} ${worked.length === 1 ? "day" : "days"} worked`;
    } else {
      const planned = days.filter((d) => plannedDays.has(d));
      const done = planned.filter((d) => logged.has(d)).length;
      w.planned_days_worked = `${done} of ${planned.length} planned days worked`;
    }
  }

  let extra = 0;
  for (const e of entries) if (!slotOn.has(e.local_date)) extra += e.minutes;

  return {
    month,
    // Dates were walked in order, so the weeks already are.
    weeks: [...weeks.values()],
    totals: {
      logged_minutes: entries.reduce((sum, e) => sum + e.minutes, 0),
      sessions: entries.length,
      longest_streak_days: longestStreak(slots, logged),
      extra_off_day_minutes: extra,
    },
  };
}
