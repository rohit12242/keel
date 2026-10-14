import { describe, expect, it } from "vitest";
import { validateEffortEdit } from "./validateEffortEdit";

const fields = (r: ReturnType<typeof validateEffortEdit>) =>
  r.ok ? [] : r.errors.map((e) => e.field);

describe("validateEffortEdit", () => {
  it("accepts any one editable field on its own", () => {
    expect(validateEffortEdit({ minutes: 45 })).toEqual({
      ok: true,
      value: { minutes: 45 },
    });
    expect(validateEffortEdit({ occurred_at_local: "07:30" })).toEqual({
      ok: true,
      value: { occurred_at_local: "07:30" },
    });
    expect(validateEffortEdit({ note: "x" })).toEqual({
      ok: true,
      value: { note: "x" },
    });
    expect(validateEffortEdit({ link: null })).toEqual({
      ok: true,
      value: { link: null },
    });
  });

  it("accepts all four together", () => {
    const body = {
      minutes: 1440,
      occurred_at_local: "23:59",
      note: "n".repeat(2000),
      link: "l".repeat(500),
    };
    expect(validateEffortEdit(body)).toEqual({ ok: true, value: body });
  });

  it("refuses local_date, whatever its value — the day cannot move", () => {
    expect(fields(validateEffortEdit({ local_date: "2026-09-16" }))).toEqual([
      "local_date",
    ]);
    expect(
      fields(validateEffortEdit({ local_date: "2026-09-16", minutes: 30 })),
    ).toEqual(["local_date"]);
  });

  it("refuses a body that changes nothing", () => {
    expect(fields(validateEffortEdit({}))).toEqual(["body"]);
    expect(fields(validateEffortEdit({ tz: "UTC", extra: true }))).toEqual([
      "body",
    ]);
  });

  it("refuses a body that is not an object", () => {
    for (const bad of [null, "x", 3, [1]]) {
      expect(fields(validateEffortEdit(bad))).toEqual(["body"]);
    }
  });

  it("names every bad field at once", () => {
    expect(
      fields(
        validateEffortEdit({
          minutes: 0,
          occurred_at_local: "7:30",
          note: "",
          link: 5,
        }),
      ),
    ).toEqual(["minutes", "occurred_at_local", "note", "link"]);
  });

  it.each([
    ["minutes", 1441],
    ["minutes", 1.5],
    ["minutes", "30"],
    ["occurred_at_local", "07:60"],
    ["occurred_at_local", 730],
    ["note", "n".repeat(2001)],
    ["note", 1],
    ["link", "l".repeat(501)],
  ])("refuses %s = %j", (field, value) => {
    expect(fields(validateEffortEdit({ [field]: value }))).toEqual([field]);
  });
});
