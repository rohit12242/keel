import { describe, expect, it } from "vitest";
import type { DayObjective } from "@/shared/contract";
import { validateEffortEntryWrite } from "@/modules/effort/domain/validateWrite";
import {
  buttonLabel,
  checkEntry,
  clockIn,
  cut,
  dayTurned,
  durationLabel,
  hint,
  nowTimes,
  parseTime,
  SAVE_FAILED,
  spanMinutes,
  TOAST,
  type Draft,
  type PageEntry,
} from "./logTime";

const DATE = "2026-09-05";
const ZONE = "Asia/Kolkata";
const ctx = (entries: PageEntry[] = [], editing?: PageEntry) => ({
  date: DATE,
  zone: ZONE,
  entries,
  editing,
});
const draft = (over: Partial<Draft> = {}): Draft => ({
  objectiveId: "o1",
  start: "09:20",
  end: "10:20",
  note: "Two-pointer problems — four solved",
  ...over,
});
const ON_PAGE: PageEntry = {
  id: "e1",
  occurred_at_local: "09:20",
  minutes: 60,
  note: "Two-pointer problems — four solved",
};

describe("parseTime", () => {
  it("reads every form the design accepts", () => {
    for (const typed of ["920", "0920", "9:20", "9.20", " 09:20 "]) {
      expect(parseTime(typed)).toBe("09:20");
    }
    expect(parseTime("21")).toBe("21:00");
    expect(parseTime("0")).toBe("00:00");
    expect(parseTime("2359")).toBe("23:59");
  });

  it("refuses what isn't a 24-hour time", () => {
    for (const typed of ["2400", "9:60", "abc", "", "12345", "9:5", "24"]) {
      expect(parseTime(typed)).toBeNull();
    }
  });
});

describe("spans", () => {
  it("counts start to end, and nothing unless end is later", () => {
    expect(spanMinutes("9:20", "10:20")).toBe(60);
    expect(spanMinutes("10:20", "10:20")).toBeNull();
    expect(spanMinutes("x", "10:20")).toBeNull();
    expect(durationLabel("920", "1020")).toBe("1h 00m");
    expect(durationLabel("23:30", "00:30")).toBe("—");
  });
});

describe("Now", () => {
  // 10:15 in Kolkata.
  const now = new Date("2026-09-05T04:45:00Z");

  it("fills End with the time in Today's zone, and Start an hour earlier if empty", () => {
    expect(clockIn(now, ZONE)).toBe("10:15");
    expect(nowTimes(now, ZONE, "")).toEqual({ start: "09:15", end: "10:15" });
    expect(nowTimes(now, ZONE, "08:00")).toEqual({
      start: "08:00",
      end: "10:15",
    });
  });

  it("never puts Start before midnight", () => {
    // 00:20 in Kolkata.
    const early = new Date("2026-09-04T18:50:00Z");
    expect(nowTimes(early, ZONE, " ")).toEqual({
      start: "00:00",
      end: "00:20",
    });
  });
});

describe("checkEntry — the design's messages", () => {
  it("names every bad field, objective first", () => {
    expect(
      checkEntry({ objectiveId: null, start: "", end: "", note: " " }, ctx()),
    ).toEqual({
      ok: false,
      errors: {
        objective: "Pick an objective.",
        when: "Enter start and end in 24-hour time, like 09:20.",
        note: "Add a line about what you did.",
      },
      first: "objective",
    });
  });

  it("end must be after start; an entry can't cross midnight", () => {
    for (const [start, end] of [
      ["10:20", "10:20"],
      ["10:20", "09:20"],
      ["23:30", "00:30"],
    ]) {
      expect(checkEntry(draft({ start, end }), ctx())).toMatchObject({
        ok: false,
        errors: { when: "End time must be after start time." },
        first: "when",
      });
    }
  });

  it("an overlap names the entry, its note cut to fit", () => {
    expect(
      checkEntry(draft({ start: "10:19", end: "11:00" }), ctx([ON_PAGE])),
    ).toMatchObject({
      ok: false,
      errors: {
        when: "Overlaps 09:20–10:20 (Two-pointer problems — four…). Change the times.",
      },
    });
  });

  it("touching is not overlapping", () => {
    expect(
      checkEntry(draft({ start: "10:20", end: "11:00" }), ctx([ON_PAGE])).ok,
    ).toBe(true);
  });

  it("an entry being edited never clashes with itself; one with no start clashes with nothing", () => {
    expect(checkEntry(draft(), ctx([ON_PAGE], ON_PAGE)).ok).toBe(true);
    const noStart: PageEntry = { id: "e2", minutes: 60, note: "old" };
    expect(checkEntry(draft(), ctx([noStart])).ok).toBe(true);
  });

  it("a new note stops at 120; an old longer one saves as it is", () => {
    expect(checkEntry(draft({ note: "x".repeat(120) }), ctx()).ok).toBe(true);
    expect(checkEntry(draft({ note: "x".repeat(121) }), ctx())).toMatchObject({
      errors: { note: "Keep it to 120 characters." },
    });
    const old: PageEntry = { ...ON_PAGE, note: "y".repeat(300) };
    expect(checkEntry(draft({ note: old.note }), ctx([old], old)).ok).toBe(
      true,
    );
  });

  it("an old entry with no start time must be given one", () => {
    const noStart: PageEntry = { id: "e2", minutes: 60, note: "old" };
    expect(
      checkEntry(draft({ start: "", end: "" }), ctx([noStart], noStart)),
    ).toMatchObject({ ok: false, first: "when" });
  });
});

describe("checkEntry — the body", () => {
  it("sends the start, the minutes, the trimmed note, and the day and zone Today shows", () => {
    expect(
      checkEntry(
        draft({ start: "920", end: "10.20", note: "  Read  " }),
        ctx(),
      ),
    ).toEqual({
      ok: true,
      objectiveId: "o1",
      body: {
        local_date: DATE,
        tz: ZONE,
        occurred_at_local: "09:20",
        minutes: 60,
        note: "Read",
      },
    });
  });
});

describe("whatever passes the dialog, the API accepts", () => {
  it("a grid of drafts: every body checkEntry passes is one validateEffortEntryWrite takes", () => {
    const times = [
      "0",
      "000",
      "0:00",
      "9.20",
      "920",
      "0920",
      "12",
      "2359",
      "23:58",
    ];
    const notes = ["a", "x".repeat(120), "  padded  "];
    let passed = 0;
    for (const start of times)
      for (const end of times)
        for (const note of notes)
          for (const zone of [ZONE, "UTC", "America/Los_Angeles"]) {
            const checked = checkEntry(
              { objectiveId: "o1", start, end, note },
              { date: DATE, zone, entries: [] },
            );
            if (!checked.ok) continue;
            passed++;
            const accepted = validateEffortEntryWrite(checked.body);
            if (!accepted.ok) {
              throw new Error(
                `refused: ${JSON.stringify(checked.body)} → ${JSON.stringify(accepted)}`,
              );
            }
          }
    expect(passed).toBeGreaterThan(100);
  });
});

describe("hint", () => {
  const planned: DayObjective = {
    id: "o1",
    title: "Python and DSA",
    start_date: "2026-08-24",
    end_date: "2026-09-20",
    schedule: {
      mode: "fixed",
      planned_weekdays: [6],
      minutes_per_planned_day: 120,
      label: "FIXED · SAT · 2h 00m PER DAY",
    },
    slot: {
      period_kind: "day",
      period_start: DATE,
      period_end: DATE,
      target_minutes: 120,
      target_days: null,
    },
    entries: [],
    logged_minutes: 40,
    adherence_to_date: 80,
    track: "on_track",
  };

  it("says what a planned objective has left, or that it is met", () => {
    expect(hint(planned, 60)).toBe("Leaves 20m on today's plan");
    expect(hint(planned, null)).toBe("Leaves 1h 20m on today's plan");
    expect(hint(planned, 80)).toBe("Meets today's plan");
    expect(hint(planned, 90)).toBe("Meets today's plan");
  });

  it("on edit, the entry's old minutes come out first", () => {
    expect(hint(planned, 60, { objective_id: "o1", minutes: 40 })).toBe(
      "Leaves 1h on today's plan",
    );
    // Moved here from another objective: nothing comes out.
    expect(hint(planned, 60, { objective_id: "o2", minutes: 40 })).toBe(
      "Leaves 20m on today's plan",
    );
  });

  it("time on an objective not planned today is extra; no objective, no hint", () => {
    expect(hint({ ...planned, slot: null }, 60)).toBe(
      "Counts as extra, off-day time",
    );
    expect(hint(undefined, 60)).toBeNull();
  });
});

describe("words", () => {
  it("the button carries the duration", () => {
    expect(buttonLabel(60, false)).toBe("Log 1h");
    expect(buttonLabel(null, false)).toBe("Log time");
    expect(buttonLabel(60, true)).toBe("Save");
  });

  it("the toasts, and a note cut to fit", () => {
    expect(TOAST.logged(60, "Python and DSA")).toBe(
      "Logged 1h to Python and DSA.",
    );
    expect(cut("short")).toBe("short");
    expect(dayTurned("Saturday, 5 September")).toMatch(
      /^Saturday, 5 September is over/,
    );
    expect(SAVE_FAILED).toMatch(/Nothing was changed/);
  });
});
