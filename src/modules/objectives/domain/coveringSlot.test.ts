import { describe, expect, it } from "vitest";
import { coveringSlot, isDateInPlan, nextPlannedDate } from "./coveringSlot";
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

  it("picks up again on the day the objective resumes", () => {
    const events: StatusEventRow[] = [
      ...CREATED,
      { occurred_on: "2026-09-19", change: "paused" },
      { occurred_on: "2026-09-23", change: "resumed" },
    ];
    // Mon 21st and Tue 22nd are planned weekdays, but paused.
    expect(nextPlannedDate([MON_TO_FRI], events, "2026-09-18")).toBe(
      "2026-09-23",
    );
  });

  it("takes the soonest across segments, whatever order they arrive in", () => {
    const LATER: SegmentForSlots = {
      ...MON_TO_FRI,
      startDate: "2026-10-12",
      endDate: "2026-10-25",
    };
    expect(nextPlannedDate([MON_TO_FRI, LATER], CREATED, "2026-09-18")).toBe(
      "2026-09-21",
    );
    expect(nextPlannedDate([LATER, MON_TO_FRI], CREATED, "2026-09-18")).toBe(
      "2026-09-21",
    );
  });

  it("does not plan from a flexible segment yet (E-02)", () => {
    const FLEXIBLE: SegmentForSlots = {
      ...MON_TO_FRI,
      scheduleMode: "flexible",
      plannedWeekdays: [],
    };
    expect(nextPlannedDate([FLEXIBLE], CREATED, "2026-09-18")).toBeNull();
  });
});

/**
 * The "outside the plan" rule (W3-14): a date outside every segment's range is
 * refused; inside the range but on an off day is allowed and counts as extra.
 */
describe("isDateInPlan", () => {
  // Two segments with a hole between them (10-12 … 10-18 is unplanned).
  const LATER: SegmentForSlots = {
    ...MON_TO_FRI,
    startDate: "2026-10-19",
    endDate: "2026-10-25",
  };

  it("is true for a date inside the range, including an off day", () => {
    expect(isDateInPlan([MON_TO_FRI], "2026-09-16")).toBe(true);
    expect(isDateInPlan([MON_TO_FRI], "2026-09-19")).toBe(true); // Saturday
  });

  it("includes the first and the last day", () => {
    expect(isDateInPlan([MON_TO_FRI], "2026-09-14")).toBe(true);
    expect(isDateInPlan([MON_TO_FRI], "2026-10-11")).toBe(true);
  });

  it("is false the day before the start and the day after the end", () => {
    expect(isDateInPlan([MON_TO_FRI], "2026-09-13")).toBe(false);
    expect(isDateInPlan([MON_TO_FRI], "2026-10-12")).toBe(false);
  });

  it("is false in a gap between two segments, true in either one", () => {
    expect(isDateInPlan([MON_TO_FRI, LATER], "2026-10-15")).toBe(false);
    expect(isDateInPlan([MON_TO_FRI, LATER], "2026-10-20")).toBe(true);
  });

  it("is false with no segments at all", () => {
    expect(isDateInPlan([], "2026-09-16")).toBe(false);
  });
});
