/**
 * effort/domain — pure. Imports nothing that speaks HTTP or SQL (ADR-001).
 *
 * SCAFFOLDING STUB. This is deliberately trivial: enough of the real
 * `adherence` rule (ADR-001's flagship six-call-site function) to give the
 * import-boundary lint rule and the test runner a subject to guard. The real
 * rule — planned days worked, target met, over slots and entries — lands in
 * Sprint 02, not here (W3-09 is scaffolding only).
 *
 * No aggregate is stored (NFR-09): a percentage is always computed at read
 * time from its inputs, which is exactly what this function models.
 */
export function adherence(targetDays: number, workedDays: number): number {
  if (targetDays <= 0) return 0;
  const capped = Math.min(workedDays, targetDays);
  return Math.round((capped / targetDays) * 100);
}
