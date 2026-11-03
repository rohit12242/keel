import { describe, expect, it } from "vitest";
import {
  CHANGED_ELSEWHERE,
  checkReason,
  dialogWords,
  footer,
  loggedToday,
  NOTE_MAX,
  NOTE_NOT_SAVED,
  noteBody,
  notChanged,
  pausedToast,
  REASON_MAX,
  resumedToast,
  statusBody,
  TERMINATED,
} from "./statusActions";

const TODAY = "2026-09-05";
const running = { status: "active" as const, end_date: "2026-09-21" };

describe("footer", () => {
  it("offers Pause and Terminate while running or not started", () => {
    expect(footer(running, TODAY)).toEqual({
      line: "Schedule and target are fixed. They change only when you extend at the final review.",
      pause: true,
      terminate: true,
    });
    // Its last day is still running.
    expect(footer({ ...running, end_date: TODAY }, TODAY).pause).toBe(true);
  });

  it("offers Terminate only once the plan has ended", () => {
    expect(footer({ ...running, end_date: "2026-09-04" }, TODAY)).toEqual({
      line: "The plan has ended. The final review decides what happens next.",
      pause: false,
      terminate: true,
    });
  });

  it("offers Terminate while paused, and nothing once final", () => {
    expect(footer({ ...running, status: "paused" }, TODAY)).toEqual({
      line: "Resume to plan days again. Terminating can't be undone.",
      pause: false,
      terminate: true,
    });
    for (const status of ["completed", "ended"] as const) {
      expect(footer({ ...running, status }, TODAY)).toEqual({
        line: "This status is final. You can keep adding notes.",
        pause: false,
        terminate: false,
      });
    }
  });
});

describe("the dialogs", () => {
  it("Pause reads as designed, with the end date", () => {
    expect(dialogWords("pause", running, TODAY)).toEqual({
      title: "Pause this objective?",
      body: "Days stop being planned until you resume. The end date stays Mon 21 Sep, so paused days are not made up. Reviews wait too.",
      label: "Why are you pausing?",
      hint: "It goes into the status history, word for word.",
      action: "Pause it",
      danger: false,
    });
  });

  it("Terminate reads as designed, with a red action", () => {
    expect(dialogWords("terminate", running, TODAY)).toEqual({
      title: "Terminate this objective?",
      body: "It moves to Terminated and can't be resumed. Its effort, deviations, reviews and notes are kept.",
      label: "Why are you terminating it?",
      hint: null,
      action: "Terminate",
      danger: true,
    });
    expect(REASON_MAX).toBe(280);
  });

  it("says today's logged time stays, as extra", () => {
    expect(loggedToday(0)).toBeNull();
    expect(loggedToday(80)).toBe(
      "Today stops being planned. The 1h 20m logged today stays, as extra.",
    );
    expect(loggedToday(45)).toBe(
      "Today stops being planned. The 45m logged today stays, as extra.",
    );
  });

  it("requires a reason; spaces alone are none", () => {
    expect(checkReason("pause", "")).toBe("Write why you are pausing it.");
    expect(checkReason("pause", "   ")).toBe("Write why you are pausing it.");
    expect(checkReason("terminate", "\n")).toBe(
      "Write why you are terminating it.",
    );
    expect(checkReason("pause", "x".repeat(280))).toBeNull();
  });
});

describe("the requests", () => {
  it("dates a change by the day given, with the reason as typed", () => {
    expect(statusBody("pause", "2026-09-05", " Exams ")).toEqual({
      change: "pause",
      occurred_on: "2026-09-05",
      reason: " Exams ",
    });
    expect(statusBody("terminate", "2026-09-05", "Done")).toEqual({
      change: "end",
      occurred_on: "2026-09-05",
      reason: "Done",
    });
    expect(statusBody("resume", "2026-09-06")).toEqual({
      change: "resume",
      occurred_on: "2026-09-06",
    });
  });

  it("sends a note as typed, and nothing for an empty one", () => {
    expect(noteBody("Hard week", TODAY)).toEqual({
      written_on: TODAY,
      text: "Hard week",
    });
    expect(noteBody("  ", TODAY)).toBeNull();
    expect(NOTE_MAX).toBe(120);
  });
});

describe("the toasts and failures", () => {
  it("pause and terminate", () => {
    expect(pausedToast(running, TODAY)).toBe(
      "Paused. The end date stays Mon 21 Sep.",
    );
    expect(TERMINATED).toBe("Terminated. Everything recorded is kept.");
  });

  it("resume: back on Today, or the final review is due past the end", () => {
    const ended = { status: "paused" as const, end_date: "2026-09-04" };
    expect(resumedToast(running, [], TODAY)).toBe(
      "Resumed. It is back on Today.",
    );
    // On its last day the due banner says it; the toast doesn't.
    expect(resumedToast({ ...running, end_date: TODAY }, [], TODAY)).toBe(
      "Resumed. It is back on Today.",
    );
    expect(resumedToast(ended, [], TODAY)).toBe(
      "Resumed. Its plan has ended, so the final review is due.",
    );
    const final = {
      kind: "plan_end" as const,
      period_end: "2026-09-04",
      status: "saved" as const,
    };
    expect(resumedToast(ended, [final], TODAY)).toBe(
      "Resumed. It is back on Today.",
    );
    expect(resumedToast(ended, [{ ...final, status: "draft" }], TODAY)).toBe(
      "Resumed. Its plan has ended, so the final review is due.",
    );
    expect(resumedToast(ended, [{ ...final, kind: "weekly" }], TODAY)).toBe(
      "Resumed. Its plan has ended, so the final review is due.",
    );
    expect(
      resumedToast(ended, [{ ...final, period_end: "2026-08-01" }], TODAY),
    ).toBe("Resumed. Its plan has ended, so the final review is due.");
  });

  it("says nothing was changed, or that it changed elsewhere", () => {
    expect(notChanged("pause")).toBe(
      "Couldn't pause it. Nothing was changed. Try again.",
    );
    expect(notChanged("resume")).toBe(
      "Couldn't resume it. Nothing was changed. Try again.",
    );
    expect(notChanged("terminate")).toBe(
      "Couldn't terminate it. Nothing was changed. Try again.",
    );
    expect(CHANGED_ELSEWHERE).toBe(
      "This objective changed somewhere else. Nothing was changed here.",
    );
    expect(NOTE_NOT_SAVED).toBe(
      "Couldn't save the note. Nothing was saved. Try again.",
    );
  });
});
