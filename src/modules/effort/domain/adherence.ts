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
  let over = 0;
  let weeks = 0;
  let weeksMet = 0;

  for (const slot of slots) {
    const minutes = slot.activeDays.map((d) => dailyMinutes[d] ?? 0);
    slot.activeDays.forEach((d) => covered.add(d));
    const inSlot = minutes.reduce((sum, m) => sum + m, 0);

    target += slot.targetMinutes;
    // Capped per slot: a long day cannot make up a missed one (rule 3).
    credited += Math.min(inSlot, slot.targetMinutes);
    // What the cap leaves out, so no minute is lost (rule 7).
    over += inSlot - Math.min(inSlot, slot.targetMinutes);

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
      // A week is met when its minutes reach its target (rule 8).
      weeks += 1;
      if (inSlot >= slot.targetMinutes) weeksMet += 1;
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
    over_target_minutes: over,
    planned_weeks: weeks,
    target_met_weeks: weeksMet,
  };
}

type Period = { period_start: string; period_end: string };
const inPeriod = (date: string, p: Period) =>
  date >= p.period_start && date <= p.period_end;

/**
 * The figures over one window (docs/domain/adherence.md, *Over a window*). A
 * slot belongs to the window its period starts in; minutes count only on the
 * window's days. A day covered by any slot of the plan is not extra, even one
 * whose slot started in the window before. Reviews, plan weeks and the plan
 * so far all read it.
 */
export function windowFigures(
  window: Period,
  slots: readonly PlannedSlot[],
  daily: DailyMinutes,
): Required<Figures> {
  const inside = Object.fromEntries(
    Object.entries(daily).filter(([d]) => inPeriod(d, window)),
  );
  const f = figures(
    slots.filter((s) => inPeriod(s.periodStart, window)),
    inside,
  );
  const covered = new Set(slots.flatMap((s) => s.activeDays));
  f.extra_off_day_minutes = Object.entries(inside)
    .filter(([d]) => !covered.has(d))
    .reduce((sum, [, m]) => sum + m, 0);
  return f;
}

/**
 * The slots the plan so far is judged on (*So far*): those whose period
 * ended before today, plus today's day slot. A week still in progress is
 * not among them — it counts once it has ended, so it never lowers the score.
 */
export function slotsToDate(
  slots: readonly PlannedSlot[],
  today: string,
): PlannedSlot[] {
  return slots.filter(
    (s) =>
      s.periodEnd < today ||
      (s.periodKind === "day" && s.periodStart === today),
  );
}

/**
 * The figures to date (G14): the same rule over `slotsToDate`, and the
 * minutes up to today. The days of a slot not yet judged — a week in
 * progress — are left out entirely, minutes as well as target, so logged =
 * credited + over target + extra still holds.
 */
export function figuresToDate(
  slots: readonly PlannedSlot[],
  daily: DailyMinutes,
  today: string,
): Required<Figures> {
  const judged = slotsToDate(slots, today);
  const pending = new Set(
    slots.filter((s) => !judged.includes(s)).flatMap((s) => s.activeDays),
  );
  return figures(
    judged,
    Object.fromEntries(
      Object.entries(daily).filter(([d]) => d <= today && !pending.has(d)),
    ),
  );
}
