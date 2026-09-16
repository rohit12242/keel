/**
 * Generate the plan slots for a plan segment (ADR-001 domain: pure, no I/O).
 *
 * A fixed schedule makes one *day* slot per planned weekday inside the
 * segment's date range. Flexible (week) schedules are not needed yet — the
 * W3-12 seed uses a fixed segment — and are left explicitly unimplemented so a
 * caller cannot silently get wrong rows.
 *
 * Dates are handled as YYYY-MM-DD strings in UTC throughout, so nothing here
 * depends on the machine's timezone (the real timezone rules are NFR-12, v2).
 */

export type SegmentForSlots = {
  scheduleMode: "fixed" | "flexible";
  /** ISO weekdays: 1 = Monday … 7 = Sunday. Required for a fixed schedule. */
  plannedWeekdays: number[];
  minutesPerPlannedDay: number;
  /** Inclusive range, YYYY-MM-DD. */
  startDate: string;
  endDate: string;
};

export type GeneratedSlot = {
  periodKind: "day";
  periodStart: string;
  periodEnd: string;
  targetMinutes: number;
  targetDays: null;
};

const DAY_MS = 86_400_000;

function isoWeekday(dateUtc: number): number {
  const dow = new Date(dateUtc).getUTCDay(); // 0 = Sunday … 6 = Saturday
  return dow === 0 ? 7 : dow;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function parseIso(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function generateSlots(segment: SegmentForSlots): GeneratedSlot[] {
  if (segment.scheduleMode !== "fixed") {
    throw new Error(
      "generateSlots: only fixed schedules are supported yet (flexible/week slots arrive with the flexible objective story).",
    );
  }

  const planned = new Set(segment.plannedWeekdays);
  const start = parseIso(segment.startDate);
  const end = parseIso(segment.endDate);
  const slots: GeneratedSlot[] = [];

  for (let ms = start; ms <= end; ms += DAY_MS) {
    if (planned.has(isoWeekday(ms))) {
      const day = toIso(ms);
      slots.push({
        periodKind: "day",
        periodStart: day,
        periodEnd: day,
        targetMinutes: segment.minutesPerPlannedDay,
        targetDays: null,
      });
    }
  }

  return slots;
}
