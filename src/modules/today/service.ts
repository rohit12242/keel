import type { Day } from "@/shared/contract";
import { present } from "@/modules/deviations/service";
import { assembleDay } from "./domain/assembleDay";
import { getDayFacts } from "./repo";

/**
 * The Today use case: read the day for the signed-in user and shape it. One
 * repository call → one query.
 */
export async function getDay(userId: string, date: string): Promise<Day> {
  const facts = await getDayFacts(userId, date);
  return assembleDay(
    date,
    facts.objectives,
    facts.last_deviation ? present(facts.last_deviation) : null,
  );
}
