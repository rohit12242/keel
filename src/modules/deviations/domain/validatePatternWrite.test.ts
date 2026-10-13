import { describe, expect, it } from "vitest";
import { validatePatternWrite } from "./validatePatternWrite";

describe("validatePatternWrite", () => {
  it("accepts a name, trimmed, with or without a description", () => {
    expect(
      validatePatternWrite({ name: "  Planning instead of doing " }),
    ).toEqual({
      ok: true,
      value: { name: "Planning instead of doing", description: null },
    });
    expect(
      validatePatternWrite({
        name: "Self-doubt",
        description: "Second-guessing.",
      }),
    ).toEqual({
      ok: true,
      value: { name: "Self-doubt", description: "Second-guessing." },
    });
    expect(validatePatternWrite({ name: "x", description: "" })).toEqual({
      ok: true,
      value: { name: "x", description: null },
    });
    expect(validatePatternWrite({ name: "x", description: null }).ok).toBe(
      true,
    );
  });

  it.each([
    [{}, ["name"]],
    [{ name: "   " }, ["name"]],
    [{ name: "n".repeat(121) }, ["name"]],
    [{ name: 3 }, ["name"]],
    [{ name: "ok", description: "d".repeat(2001) }, ["description"]],
    [{ name: "ok", description: 4 }, ["description"]],
    [null, ["name"]],
    [["name"], ["name"]],
  ])("refuses %j", (body, fields) => {
    const r = validatePatternWrite(body);
    expect(r.ok ? [] : r.error.map((e) => e.field)).toEqual(fields);
  });
});
