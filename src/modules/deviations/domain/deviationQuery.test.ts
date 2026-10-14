import { describe, expect, it } from "vitest";
import { parseDeviationQuery } from "./deviationQuery";

const A = "0b6f3c1e-7d1a-4c55-9a51-6f0c2a8e9b11";
const fields = (r: ReturnType<typeof parseDeviationQuery>) =>
  r.ok ? [] : r.error.map((e) => e.field);

describe("parseDeviationQuery", () => {
  it("accepts a range, with or without an objective", () => {
    expect(parseDeviationQuery("2026-09-01", "2026-09-30", null)).toEqual({
      ok: true,
      value: { from: "2026-09-01", to: "2026-09-30", objectiveId: null },
    });
    expect(parseDeviationQuery("2026-09-01", "2026-09-01", A)).toMatchObject({
      ok: true,
      value: { objectiveId: A },
    });
  });

  it("requires both ends, as real dates, in order", () => {
    expect(fields(parseDeviationQuery(null, null, null))).toEqual([
      "from",
      "to",
    ]);
    expect(
      fields(parseDeviationQuery("2026-02-30", "2026-03-01", null)),
    ).toEqual(["from"]);
    expect(
      fields(parseDeviationQuery("2026-09-30", "2026-09-01", null)),
    ).toEqual(["to"]);
  });

  it("refuses an objective id that is not one", () => {
    expect(
      fields(parseDeviationQuery("2026-09-01", "2026-09-30", "x")),
    ).toEqual(["objective_id"]);
  });
});
