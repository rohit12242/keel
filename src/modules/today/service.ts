import type { Day } from "@/shared/contract";
import { assembleDay } from "./domain/assembleDay";
import { getDayRows } from "./repo";

/**
 * The Today use case: read the day for the signed-in user and shape it. One
 * repository call → one query.
 */
export async function getDay(userId: string, date: string): Promise<Day> {
  const rows = await getDayRows(userId, date);
  return assembleDay(date, rows);
}
