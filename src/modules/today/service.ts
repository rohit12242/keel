import { getConfig } from "@/config/env";
import type { Day } from "@/shared/contract";
import { assembleDay } from "./domain/assembleDay";
import { getDayRows } from "./repo";

/**
 * The Today use case: read the day for the current user (the seeded user until
 * auth, E-06) and shape it. One repository call → one query.
 */
export async function getDay(date: string): Promise<Day> {
  const { seedUserId } = getConfig();
  const rows = await getDayRows(seedUserId, date);
  return assembleDay(date, rows);
}
