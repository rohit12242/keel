import { describe, expect, it } from "vitest";
import { coveringSlot, nextPlannedDate } from "./coveringSlot";
import type { SegmentForSlots } from "./generateSlots";
import type { StatusEventRow } from "./statusTimeline";

/**
 * The rule `plan_slot` used to hold as rows (ADR-008, ERD invariants 9 and 10).
 * The paused cases are the point: that behaviour was previously encoded by not
 * writing slot rows while paused, and the computed path has to reproduce it.
 */
const MON_TO_FRI: SegmentForSlots = {
  scheduleMode: "fixed",
  plannedWeekdays: [1, 2, 3, 4, 5],
  minutesPerPlannedDay: 120,
  startDate: "2026-09-14", // Monday
  endDate: "2026-10-11", // Sunday
};

const CREATED: StatusEventRow[] = [
  { occurred_on: "2026-09-14", change: "created" },
];

describe("coveringSlot", () => {
  // --- nothing plans that day ---------------------------------------------

  it("is null for a day the objective was paused (invariant 10)", () => {
    const events: StatusEventRow[] = [
      ...CREATED,
      { occurred_on: "2026-09-16", change: "paused" },
    ];
    // Thursday 17th is a planned weekday inside the segment, but paused.
    expect(coveringSlot([MON_TO_FRI], events, "2026-09-17")).toBeNull();
  });

  it("plans again from the day it resumed", () => {
    const events: StatusEventRow[] = [
      ...CREATED,
      { occurred_on: "2026-09-16", change: "paused" },
      { occurred_on: "2026-09-21", change: "resumed" },
    ];
    expect(coveringSlot([MON_TO_FRI], events, "2026-09-17")).toBeNull();
    expect(coveringSlot([MON_TO_FRI], events, "2026-09-21")?.periodStart).toBe(
      "2026-09-21",
    );
  });

  it("is null after the objective is completed or ended", () => {
    for (const change of ["completed", "ended"] as const) {
      const events: StatusEventRow[] = [
        ...CREATED,
        { occurred_on: "2026-09-18", change },
      ];
      expect(coveringSlot([MON_TO_FRI], events, "2026-09-21")).toBeNull();
    }
  });

  it("is null on a weekday the schedule does not plan", () => {
    // Saturday 19th — inside the range, not a planned weekday.
    expect(coveringSlot([MON_TO_FRI], CREATED, "2026-09-19")).toBeNull();
  });

  it("is null outside every segment's range", () => {
    expect(coveringSlot([MON_TO_FRI], CREATED, "2026-09-13")).toBeNull();
    expect(coveringSlot([MON_TO_FRI], CREATED, "2026-10-12")).toBeNull();
  });

  it("is null when the objective has no status events at all", () => {
    // No 'created' event means no status (ERD invariant 16), so nothing is planned.
    expect(coveringSlot([MON_TO_FRI], [], "2026-09-16")).toBeNull();
  });

  it("is null for a flexible segment, rather than throwing", () => {
    const flexible: SegmentForSlots = {
      ...MON_TO_FRI,
      scheduleMode: "flexible",
      plannedWeekdays: [],
    };
    expect(coveringSlot([flexible], CREATED, "2026-09-16")).toBeNull();
  });

  // --- the day is planned ---------------------------------------------------

  it("returns the day's slot with its target when the plan asks for it", () => {
    const slot = coveringSlot([MON_TO_FRI], CREATED, "2026-09-16");
    expect(slot).toEqual({
      periodKind: "day",
      periodStart: "2026-09-16",
      periodEnd: "2026-09-16",
      targetMinutes: 120,
      targetDays: null,
    });
  });

  it("uses the segment that covers the date when there are several", () => {
    const extension: SegmentForSlots = {
      scheduleMode: "fixed",
      plannedWeekdays: [3], // Wednesdays only
      minutesPerPlannedDay: 30,
      startDate: "2026-10-12",
      endDate: "2026-10-25",
    };
    const slot = coveringSlot(
      [MON_TO_FRI, extension],
      CREATED,
      "2026-10-14", // a Wednesday in the extension
    );
    expect(slot?.targetMinutes).toBe(30);
  });
});

describe("nextPlannedDate", () => {
  it("is the next planned day after the date", () => {
    // Friday 18th → next planned is Monday 21st.
    expect(nextPlannedDate([MON_TO_FRI], CREATED, "2026-09-18")).toBe(
      "2026-09-21",
    );
  });

  it("skips days the objective is paused for", () => {
    const events: StatusEventRow[] = [
      ...CREATED,
      { occurred_on: "2026-09-19", change: "paused" },
    ];
    // Paused from the 19th with no resume: nothing is planned after it.
    expect(nextPlannedDate([MON_TO_FRI], events, "2026-09-18")).toBeNull();
  });

  it("is null once the plan has run out", () => {
    expect(nextPlannedDate([MON_TO_FRI], CREATED, "2026-10-11")).toBeNull();
  });
});
