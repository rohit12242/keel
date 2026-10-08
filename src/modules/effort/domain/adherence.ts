import type { Figures } from "@/shared/contract";
import type { PlannedSlot } from "@/modules/objectives/domain/planSlots";

/**
 * effort/domain — pure. Imports nothing that speaks HTTP or SQL (ADR-001).
 *
 * The adherence rule and every figure that travels with it, written down in
 * docs/domain/adherence.md — that file is the authority, this is its one
 * implementation. Six screens show adherence (ADR-001); all of them call this.
 *
 * Nothing here is stored (NFR-09): every figure is recomputed from the planned
 * slots (`planSlots`, which already applied pauses) and the minutes logged per
 * local date.
 */
export type DailyMinutes = Readonly<Record<string, number>>;

export function figures(
  slots: readonly PlannedSlot[],
  dailyMinutes: DailyMinutes,
): Required<Figures> {
  const covered = new Set<string>();
  let target = 0;
  let credited = 0;
  let plannedDays = 0;
  let worked = 0;
  let met = 0;

  for (const slot of slots) {
    const minutes = slot.activeDays.map((d) => dailyMinutes[d] ?? 0);
    slot.activeDays.forEach((d) => covered.add(d));
    const inSlot = minutes.reduce((sum, m) => sum + m, 0);

    target += slot.targetMinutes;
    // Capped per slot: a long day cannot make up a missed one (rule 3).
    credited += Math.min(inSlot, slot.targetMinutes);

    if (slot.periodKind === "day") {
      plannedDays += 1;
      if (inSlot > 0) worked += 1;
      if (inSlot >= slot.targetMinutes) met += 1;
    } else {
      // A week counts days, capped at what it asked for (rule 6).
      plannedDays += slot.targetDays;
      worked += Math.min(minutes.filter((m) => m > 0).length, slot.targetDays);
      met += Math.min(
        minutes.filter((m) => m >= slot.minutesPerDay).length,
        slot.targetDays,
      );
    }
  }

  let logged = 0;
  let extra = 0;
  for (const [day, m] of Object.entries(dailyMinutes)) {
    logged += m;
    if (!covered.has(day)) extra += m;
  }

  return {
    adherence_pct: target > 0 ? Math.round((credited / target) * 100) : 0,
    logged_minutes: logged,
    target_minutes: target,
    planned_days: plannedDays,
    planned_days_worked: worked,
    target_met_days: met,
    extra_off_day_minutes: extra,
  };
}
