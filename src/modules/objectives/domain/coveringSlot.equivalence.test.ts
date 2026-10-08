import { describe, expect, it } from "vitest";
import { coveringSlot, nextPlannedDate } from "./coveringSlot";
import {
  datesBetween,
  generateSlots,
  type GeneratedSlot,
  type SegmentForSlots,
} from "./generateSlots";
import { statusOn, type StatusEventRow } from "./statusTimeline";

/**
 * I-01 step 2's guard. `coveringSlot` and `nextPlannedDate` used to suppress
 * paused days themselves (two `statusOn` checks); they now read `planSlots`,
 * where pause suppression lives. The objectives at risk are FIXED, PAUSED
 * ones: if `planSlots` suppressed even slightly differently, Today would give a
 * paused day its slot back and an entry logged while paused would lose `extra`.
 *
 * So the pre-I-01 implementations are frozen below, verbatim in behaviour, as
 * the oracle. For fixed segments under every pause timeline here, the current
 * functions must agree with them on every date across the run.
 */
function legacyCoveringSlot(
  segments: readonly SegmentForSlots[],
  statusEvents: readonly StatusEventRow[],
  date: string,
): GeneratedSlot | null {
  if (statusOn(statusEvents, date) !== "active") return null;
  for (const segment of segments) {
    if (segment.scheduleMode !== "fixed") continue;
    if (date < segment.startDate || date > segment.endDate) continue;
    const slot = generateSlots(segment).find(
      (s) => s.periodStart <= date && date <= s.periodEnd,
    );
    if (slot) return slot;
  }
  return null;
}

function legacyNextPlannedDate(
  segments: readonly SegmentForSlots[],
  statusEvents: readonly StatusEventRow[],
  date: string,
): string | null {
  let soonest: string | null = null;
  for (const segment of segments) {
    if (segment.scheduleMode !== "fixed") continue;
    if (segment.endDate <= date) continue;
    for (const slot of generateSlots(segment)) {
      if (slot.periodStart <= date) continue;
      if (statusOn(statusEvents, slot.periodStart) !== "active") continue;
      if (soonest === null || slot.periodStart < soonest) {
        soonest = slot.periodStart;
      }
      break;
    }
  }
  return soonest;
}

const MON_TO_FRI: SegmentForSlots = {
  scheduleMode: "fixed",
  plannedWeekdays: [1, 2, 3, 4, 5],
  minutesPerPlannedDay: 120,
  startDate: "2026-09-14", // Monday
  endDate: "2026-10-11",
};
const EXTENSION: SegmentForSlots = {
  scheduleMode: "fixed",
  plannedWeekdays: [2, 4, 6], // Tue, Thu, Sat
  minutesPerPlannedDay: 45,
  startDate: "2026-10-12",
  endDate: "2026-10-25",
};

const created = (): StatusEventRow[] => [
  { occurred_on: "2026-09-14", change: "created" },
];
const with_ = (...more: StatusEventRow[]): StatusEventRow[] => [
  ...created(),
  ...more,
];

const TIMELINES: Record<string, StatusEventRow[]> = {
  "never paused": created(),
  "no events at all": [],
  "paused and resumed on planned days": with_(
    { occurred_on: "2026-09-16", change: "paused" },
    { occurred_on: "2026-09-22", change: "resumed" },
  ),
  "paused and resumed on off days": with_(
    { occurred_on: "2026-09-19", change: "paused" },
    { occurred_on: "2026-09-27", change: "resumed" },
  ),
  "paused and resumed on the same day": with_(
    { occurred_on: "2026-09-17", change: "paused" },
    { occurred_on: "2026-09-17", change: "resumed" },
  ),
  "resumed and paused on the same day": with_(
    { occurred_on: "2026-09-15", change: "paused" },
    { occurred_on: "2026-09-18", change: "resumed" },
    { occurred_on: "2026-09-18", change: "paused" },
  ),
  "paused with no resume": with_({
    occurred_on: "2026-09-23",
    change: "paused",
  }),
  "two pauses": with_(
    { occurred_on: "2026-09-15", change: "paused" },
    { occurred_on: "2026-09-17", change: "resumed" },
    { occurred_on: "2026-10-01", change: "paused" },
    { occurred_on: "2026-10-14", change: "resumed" },
  ),
  completed: with_({ occurred_on: "2026-10-02", change: "completed" }),
  ended: with_({ occurred_on: "2026-09-30", change: "ended" }),
};

const SEGMENT_SETS: Record<string, SegmentForSlots[]> = {
  "one segment": [MON_TO_FRI],
  "two segments": [MON_TO_FRI, EXTENSION],
  "two segments, given out of order": [EXTENSION, MON_TO_FRI],
};

// One day either side of the whole run, so "outside the plan" is compared too.
const DATES = datesBetween("2026-09-13", "2026-10-26");

describe("fixed, paused objectives: planSlots-based rules = the pre-I-01 rules", () => {
  for (const [segName, segments] of Object.entries(SEGMENT_SETS)) {
    for (const [timeline, events] of Object.entries(TIMELINES)) {
      it(`${segName}, ${timeline}`, () => {
        for (const date of DATES) {
          expect(coveringSlot(segments, events, date), date).toEqual(
            legacyCoveringSlot(segments, events, date),
          );
          expect(nextPlannedDate(segments, events, date), date).toBe(
            legacyNextPlannedDate(segments, events, date),
          );
        }
      });
    }
  }
});
