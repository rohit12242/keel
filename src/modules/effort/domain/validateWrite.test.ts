import { describe, expect, it } from "vitest";
import { validateEffortEntryWrite } from "./validateWrite";

const valid = {
  local_date: "2026-09-16",
  tz: "Asia/Kolkata",
  minutes: 120,
  note: "Wrote the day read.",
};

describe("validateEffortEntryWrite", () => {
  it("accepts a valid body", () => {
    const r = validateEffortEntryWrite(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.minutes).toBe(120);
  });

  it("names each bad field", () => {
    const r = validateEffortEntryWrite({
      local_date: "16-09-2026",
      tz: "Not/AZone",
      minutes: 0,
      note: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const fields = r.errors.map((e) => e.field).sort();
      expect(fields).toEqual(["local_date", "minutes", "note", "tz"]);
    }
  });

  it("ignores a client-sent extra flag (never accepted)", () => {
    const r = validateEffortEntryWrite({ ...valid, extra: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect("extra" in r.value).toBe(false);
  });

  it("rejects a malformed occurred_at_local", () => {
    const r = validateEffortEntryWrite({ ...valid, occurred_at_local: "9am" });
    expect(r.ok).toBe(false);
  });
});
