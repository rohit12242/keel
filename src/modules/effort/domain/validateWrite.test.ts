import { describe, expect, it } from "vitest";
import {
  overlapping,
  spanLabel,
  validateEffortEntryWrite,
} from "./validateWrite";

const valid = {
  local_date: "2026-09-16",
  tz: "Asia/Kolkata",
  occurred_at_local: "09:20",
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
      occurred_at_local: "24:00",
      minutes: 0,
      note: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const fields = r.errors.map((e) => e.field).sort();
      expect(fields).toEqual([
        "local_date",
        "minutes",
        "note",
        "occurred_at_local",
        "tz",
      ]);
    }
  });

  it("ignores a client-sent extra flag (never accepted)", () => {
    const r = validateEffortEntryWrite({ ...valid, extra: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect("extra" in r.value).toBe(false);
  });

  it("rejects a malformed or missing occurred_at_local — every entry has a start", () => {
    const noStart: Record<string, unknown> = { ...valid };
    delete noStart.occurred_at_local;
    for (const body of [
      { ...valid, occurred_at_local: "9am" },
      { ...valid, occurred_at_local: "24:00" },
      { ...valid, occurred_at_local: "29:59" },
      noStart,
    ]) {
      const r = validateEffortEntryWrite(body);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors.map((e) => e.field)).toEqual(["occurred_at_local"]);
      }
    }
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
          "occurred_at_local",
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

describe("overlapping — no two of a user's entries on one day overlap (G29)", () => {
  const at = (occurred_at_local: string, minutes: number, id = "e") => ({
    id,
    occurred_at_local,
    minutes,
  });
  const day = [at("09:20", 60, "a"), at("13:00", 30, "b")];

  it("allows spans that only touch", () => {
    expect(overlapping(at("10:20", 30), day)).toBeNull(); // starts as a ends
    expect(overlapping(at("08:20", 60), day)).toBeNull(); // ends as a starts
  });

  it("finds a partial overlap at either end, and names the entry hit", () => {
    expect(overlapping(at("10:00", 60), day)?.id).toBe("a");
    expect(overlapping(at("12:45", 30), day)?.id).toBe("b");
  });

  it("finds a span nested inside another, or around it", () => {
    expect(overlapping(at("09:30", 10), day)?.id).toBe("a");
    expect(overlapping(at("09:00", 180), day)?.id).toBe("a");
  });

  it("compares within the day, with no wrap past midnight", () => {
    expect(overlapping(at("23:30", 60), [at("00:10", 30)])).toBeNull();
  });

  it("labels a span by its start and end", () => {
    expect(spanLabel(at("09:20", 60))).toBe("09:20–10:20");
    expect(spanLabel(at("23:30", 60))).toBe("23:30–00:30");
  });
});
