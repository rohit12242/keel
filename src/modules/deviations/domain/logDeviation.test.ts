import { describe, expect, it } from "vitest";
import {
  beforeCount,
  checkDeviation,
  choicesFor,
  emptyDraft,
  ERRORS,
  fitMinutes,
  NEW,
  NONE,
  patternLabel,
  pickDay,
  weekChips,
  type Draft,
  type Pullable,
} from "./logDeviation";

/** Sat 5 Sep 2026; its week is Mon 31 Aug – Sun 6 Sep. */
const TODAY = "2026-09-05";
const TZ = "Europe/London";

const objectives: Pullable[] = [
  {
    id: "o1",
    title: "Python and DSA",
    start_date: "2026-08-23",
    end_date: "2026-09-21",
  },
  {
    id: "o2",
    title: "Writing",
    start_date: "2026-09-03",
    end_date: "2026-10-01",
    status: "active",
  },
  {
    id: "o3",
    title: "Paused one",
    start_date: "2026-08-01",
    end_date: "2026-12-01",
    status: "paused",
  },
];

const patterns = [{ id: "p1", name: "Research spiral" }];
const ctx = { today: TODAY, tz: TZ, patterns, objectives };

const chosen: Draft = {
  ...emptyDraft(TODAY),
  kind: "chosen",
  objectiveId: "o1",
  what: "  Took the afternoon off.  ",
  reasoning: " An interview. ",
  minutes: "90",
};

describe("the day and its objectives", () => {
  it("offers Mon … Sun of this week, the days after today disabled", () => {
    const chips = weekChips(TODAY);
    expect(chips.map((c) => c.label)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(chips.map((c) => c.disabled)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(chips[5]).toEqual({
      date: "2026-09-05",
      label: "Sat",
      name: "Sat 5 Sep, today",
      disabled: false,
    });
    expect(chips[0].name).toBe("Mon 31 Aug");
  });

  it("offers the active objectives whose plan covers the day", () => {
    expect(choicesFor(objectives, "2026-09-01").map((o) => o.id)).toEqual([
      "o1",
    ]);
    expect(choicesFor(objectives, TODAY).map((o) => o.id)).toEqual([
      "o1",
      "o2",
    ]);
  });

  it("keeps the objective a new day can take, and drops one it can't", () => {
    const d = { ...emptyDraft(TODAY), objectiveId: "o2" };
    expect(pickDay(d, "2026-09-04", objectives)).toEqual({
      ...d,
      date: "2026-09-04",
    });
    expect(pickDay(d, "2026-09-01", objectives)).toEqual({
      ...d,
      date: "2026-09-01",
      objectiveId: null,
    });
  });
});

describe("small pieces", () => {
  it("takes digits only, four at most", () => {
    expect(fitMinutes("9a0")).toBe("90");
    expect(fitMinutes("-1.5")).toBe("15");
    expect(fitMinutes("123456")).toBe("1234");
  });

  it("counts a pattern's past uses", () => {
    expect(beforeCount(3)).toBe("3 before");
    expect(beforeCount(0)).toBeNull();
  });

  it("labels the pattern button", () => {
    expect(patternLabel(NONE, patterns)).toBe("None of these");
    expect(patternLabel(NEW, patterns)).toBe("+ Add a new pattern");
    expect(patternLabel("p1", patterns)).toBe("Research spiral");
    expect(patternLabel(null, patterns)).toBeNull();
  });
});

describe("checkDeviation", () => {
  it("asks for everything on an empty draft, in field order", () => {
    const c = checkDeviation({ ...emptyDraft(TODAY), date: "" }, ctx);
    expect(c).toEqual({
      ok: false,
      first: "kind",
      errors: {
        kind: ERRORS.kind,
        objective: ERRORS.objective,
        what: ERRORS.what,
        minutes: ERRORS.minutes,
        date: ERRORS.date,
      },
    });
  });

  it("builds a chosen deviation, trimmed", () => {
    expect(checkDeviation({ ...chosen, instead: " Prep. " }, ctx)).toEqual({
      ok: true,
      newPattern: null,
      body: {
        objective_ids: ["o1"],
        local_date: TODAY,
        tz: TZ,
        kind: "chosen",
        what_happened: "Took the afternoon off.",
        reasoning: "An interview.",
        did_instead: "Prep.",
        minutes: 90,
        pattern_id: null,
      },
    });
  });

  it("asks a chosen deviation for its reasoning", () => {
    const c = checkDeviation({ ...chosen, reasoning: "   " }, ctx);
    expect(c).toMatchObject({ ok: false, first: "reasoning" });
  });

  it("asks a drifted deviation for a pattern, and sends no reasoning", () => {
    const drifted: Draft = { ...chosen, kind: "drifted" };
    expect(checkDeviation(drifted, ctx)).toMatchObject({
      ok: false,
      first: "pattern",
      errors: { pattern: ERRORS.pattern },
    });
    expect(checkDeviation({ ...drifted, pattern: "gone" }, ctx)).toMatchObject({
      ok: false,
      first: "pattern",
    });

    const picked = checkDeviation({ ...drifted, pattern: "p1" }, ctx);
    expect(picked.ok && picked.body.pattern_id).toBe("p1");
    expect(picked.ok && "reasoning" in picked.body).toBe(false);

    const oneOff = checkDeviation({ ...drifted, pattern: NONE }, ctx);
    expect(oneOff.ok && oneOff.body.pattern_id).toBeNull();
  });

  it("names a new pattern, unless the name is taken in any case", () => {
    const fresh: Draft = { ...chosen, kind: "drifted", pattern: NEW };
    expect(checkDeviation(fresh, ctx)).toMatchObject({
      ok: false,
      errors: { newName: ERRORS.newName },
    });
    expect(
      checkDeviation({ ...fresh, newName: " research SPIRAL " }, ctx),
    ).toMatchObject({ ok: false, errors: { newName: ERRORS.nameTaken } });

    const made = checkDeviation(
      { ...fresh, newName: " Planning ", newDescription: " Rewriting. " },
      ctx,
    );
    expect(made.ok && made.newPattern).toEqual({
      name: "Planning",
      description: "Rewriting.",
    });
    expect(made.ok && made.body.pattern_id).toBeNull();

    const bare = checkDeviation({ ...fresh, newName: "Planning" }, ctx);
    expect(bare.ok && bare.newPattern).toEqual({ name: "Planning" });
  });

  it("takes 1 to 1440 minutes", () => {
    const at = (minutes: string) => checkDeviation({ ...chosen, minutes }, ctx);
    expect(at("0")).toMatchObject({ errors: { minutes: ERRORS.minutes } });
    expect(at("1441")).toMatchObject({ errors: { minutes: ERRORS.overADay } });
    expect(at("1440").ok).toBe(true);
    expect(at("1").ok).toBe(true);
  });

  it("refuses a day after today, and an objective the day can't take", () => {
    expect(
      checkDeviation({ ...chosen, date: "2026-09-06" }, ctx),
    ).toMatchObject({ ok: false, errors: { date: ERRORS.date } });
    expect(
      checkDeviation({ ...chosen, objectiveId: "o2", date: "2026-09-01" }, ctx),
    ).toMatchObject({ ok: false, errors: { objective: ERRORS.objective } });
    expect(checkDeviation({ ...chosen, objectiveId: "o3" }, ctx)).toMatchObject(
      { ok: false, first: "objective" },
    );
  });
});
