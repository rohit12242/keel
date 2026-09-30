import { describe, expect, it } from "vitest";
import { currentStatus, statusOn, type StatusEventRow } from "./statusTimeline";

/**
 * There is no status column any more (ADR-008): the status is the latest event.
 */
describe("statusOn", () => {
  const events: StatusEventRow[] = [
    { occurred_on: "2026-09-14", change: "created" },
    { occurred_on: "2026-09-16", change: "paused" },
    { occurred_on: "2026-09-21", change: "resumed" },
    { occurred_on: "2026-10-01", change: "completed" },
  ];

  it("is null before the objective existed (no event on or before the date)", () => {
    expect(statusOn(events, "2026-09-13")).toBeNull();
  });

  it("is null when there are no events at all (invariant 16)", () => {
    expect(statusOn([], "2026-09-16")).toBeNull();
  });

  it("reads the status in force on the day, not the current one", () => {
    expect(statusOn(events, "2026-09-14")).toBe("active");
    expect(statusOn(events, "2026-09-17")).toBe("paused");
    expect(statusOn(events, "2026-09-21")).toBe("active");
    expect(statusOn(events, "2026-10-02")).toBe("completed");
  });

  it("counts the change as happening on its own day", () => {
    // Paused on the 16th means the 16th is already paused.
    expect(statusOn(events, "2026-09-16")).toBe("paused");
  });

  it("does not depend on the order events are given in", () => {
    const shuffled = [events[2], events[0], events[3], events[1]];
    expect(statusOn(shuffled, "2026-09-17")).toBe("paused");
  });

  it("reads events given newest first", () => {
    const newestFirst = [...events].reverse();
    expect(statusOn(newestFirst, "2026-09-17")).toBe("paused");
    expect(statusOn(newestFirst, "2026-10-02")).toBe("completed");
  });

  it("takes the later write when two changes share a day", () => {
    const sameDay: StatusEventRow[] = [
      { occurred_on: "2026-09-14", change: "created" },
      { occurred_on: "2026-09-20", change: "paused" },
      { occurred_on: "2026-09-20", change: "resumed" },
    ];
    expect(statusOn(sameDay, "2026-09-20")).toBe("active");
  });
});

describe("currentStatus", () => {
  it("is the latest event, whenever it happened", () => {
    expect(
      currentStatus([
        { occurred_on: "2026-09-14", change: "created" },
        { occurred_on: "2026-09-16", change: "ended" },
      ]),
    ).toBe("ended");
  });

  it("is null with no events", () => {
    expect(currentStatus([])).toBeNull();
  });

  it("takes the latest by date, not the last one in the array", () => {
    // Newest first: a reader that took the array's tail would say "active".
    expect(
      currentStatus([
        { occurred_on: "2026-09-21", change: "paused" },
        { occurred_on: "2026-09-16", change: "resumed" },
        { occurred_on: "2026-09-14", change: "created" },
      ]),
    ).toBe("paused");
  });

  it("takes the later write when two changes share a day", () => {
    // The repository returns same-day events in recorded order; the stable
    // sort keeps it, so the second write on the 20th decides.
    expect(
      currentStatus([
        { occurred_on: "2026-09-14", change: "created" },
        { occurred_on: "2026-09-20", change: "paused" },
        { occurred_on: "2026-09-20", change: "resumed" },
      ]),
    ).toBe("active");
  });
});
