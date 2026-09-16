/**
 * Human label for a schedule, e.g. "FIXED · MON–FRI · 2h 00m PER DAY"
 * (ADR-001 domain: pure). Matches the shape shown in docs/design.
 */
const NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function weekdaysLabel(weekdays: readonly number[]): string {
  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 1) {
    return `${NAMES[sorted[0] - 1]}–${NAMES[sorted[sorted.length - 1] - 1]}`;
  }
  return sorted.map((d) => NAMES[d - 1]).join(", ");
}

export type ScheduleForLabel = {
  mode: "fixed" | "flexible";
  plannedWeekdays?: number[];
  daysPerWeek?: number;
  minutesPerPlannedDay: number;
};

export function scheduleLabel(schedule: ScheduleForLabel): string {
  const per = `${formatMinutes(schedule.minutesPerPlannedDay)} PER DAY`;
  if (schedule.mode === "fixed") {
    return `FIXED · ${weekdaysLabel(schedule.plannedWeekdays ?? [])} · ${per}`;
  }
  return `FLEXIBLE · ${schedule.daysPerWeek ?? 0} DAYS/WEEK · ${per}`;
}
