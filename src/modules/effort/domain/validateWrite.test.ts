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

  it("accepts a well-formed occurred_at_local and keeps it", () => {
    const r = validateEffortEntryWrite({
      ...valid,
      occurred_at_local: "09:30",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.occurred_at_local).toBe("09:30");
  });

  it("refuses a tz padded with spaces rather than trimming it", () => {
    // Validation sees the untrimmed value and Intl rejects it, so the trim when
    // storing never changes anything. Pinned as found (W5-06 handover).
    const r = validateEffortEntryWrite({ ...valid, tz: " Asia/Kolkata " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field)).toEqual(["tz"]);
  });

  it("treats a body that is not an object as empty, naming every required field", () => {
    for (const body of [null, "a string", 42]) {
      const r = validateEffortEntryWrite(body);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors.map((e) => e.field).sort()).toEqual([
          "local_date",
          "minutes",
          "note",
          "tz",
        ]);
      }
    }
  });

  describe("link", () => {
    it("rejects a link that is not a string", () => {
      const r = validateEffortEntryWrite({ ...valid, link: 42 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.map((e) => e.field)).toEqual(["link"]);
    });

    it("rejects a link over 500 characters", () => {
      const r = validateEffortEntryWrite({ ...valid, link: "x".repeat(501) });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.map((e) => e.field)).toEqual(["link"]);
    });

    it("accepts a link of exactly 500 characters", () => {
      const link = "x".repeat(500);
      const r = validateEffortEntryWrite({ ...valid, link });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.link).toBe(link);
    });

    it("keeps an explicit null, so a write can clear the link", () => {
      const r = validateEffortEntryWrite({ ...valid, link: null });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.link).toBeNull();
    });

    it("leaves link off entirely when the client did not send one", () => {
      const r = validateEffortEntryWrite(valid);
      expect(r.ok).toBe(true);
      if (r.ok) expect("link" in r.value).toBe(false);
    });
  });
});
