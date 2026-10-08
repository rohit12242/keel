/**
 * Generate the plan slots for a plan segment (ADR-001 domain: pure, no I/O).
 *
 * A fixed schedule makes one *day* slot per planned weekday inside the
 * segment's date range. A flexible schedule makes one *week* slot per week
 * of the range, asking for `days_per_week` days (I-01).
 *
 * The status timeline does not enter here — pause suppression is `planSlots`'
 * job. This is the schedule alone.
 *
 * Dates are handled as YYYY-MM-DD strings in UTC throughout, so nothing here
 * depends on the machine's timezone (the real timezone rules are NFR-12, v2).
 */

export type SegmentForSlots = {
  scheduleMode: "fixed" | "flexible";
  /** ISO weekdays: 1 = Monday … 7 = Sunday. Used by a fixed schedule. */
  plannedWeekdays: number[];
  /** Days asked for per week. Used by a flexible schedule; null when fixed. */
  daysPerWeek?: number | null;
  minutesPerPlannedDay: number;
  /** Inclusive range, YYYY-MM-DD. */
  startDate: string;
  endDate: string;
};

/** A day slot carries no day count; a week slot always does. */
export type GeneratedSlot = {
  periodStart: string;
  periodEnd: string;
  targetMinutes: number;
} & (
  | { periodKind: "day"; targetDays: null }
  | { periodKind: "week"; targetDays: number }
);

const DAY_MS = 86_400_000;

function isoWeekday(dateUtc: number): number {
  const dow = new Date(dateUtc).getUTCDay(); // 0 = Sunday … 6 = Saturday
  return dow === 0 ? 7 : dow;
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function parseIso(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Every date from `start` to `end`, inclusive. */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let ms = parseIso(start); ms <= parseIso(end); ms += DAY_MS) {
    out.push(toIso(ms));
  }
  return out;
}

export function generateSlots(segment: SegmentForSlots): GeneratedSlot[] {
  return segment.scheduleMode === "fixed"
    ? daySlots(segment)
    : weekSlots(segment);
}

function daySlots(segment: SegmentForSlots): GeneratedSlot[] {
  const planned = new Set(segment.plannedWeekdays);
  return datesBetween(segment.startDate, segment.endDate)
    .filter((day) => planned.has(isoWeekday(parseIso(day))))
    .map((day) => ({
      periodKind: "day",
      periodStart: day,
      periodEnd: day,
      targetMinutes: segment.minutesPerPlannedDay,
      targetDays: null,
    }));
}

/**
 * Week k is [S + 7k, S + 7k + 6], clipped to the segment's end — the same
 * tiling as a weekly review window (docs/domain/review-windows.md, "Tile from
 * the start"), so a flexible week and a weekly review cover the same days.
 * A short final week cannot ask for more days than it contains. A segment with
 * no day count asks for none and yields no slots, rather than throwing.
 */
function weekSlots(segment: SegmentForSlots): GeneratedSlot[] {
  const perWeek = segment.daysPerWeek ?? 0;
  const end = parseIso(segment.endDate);
  const slots: GeneratedSlot[] = [];

  for (let ms = parseIso(segment.startDate); ms <= end; ms += 7 * DAY_MS) {
    const weekEnd = Math.min(ms + 6 * DAY_MS, end);
    const daysInWeek = (weekEnd - ms) / DAY_MS + 1;
    const targetDays = Math.min(perWeek, daysInWeek);
    if (targetDays === 0) continue;
    slots.push({
      periodKind: "week",
      periodStart: toIso(ms),
      periodEnd: toIso(weekEnd),
      targetMinutes: targetDays * segment.minutesPerPlannedDay,
      targetDays,
    });
  }

  return slots;
}
