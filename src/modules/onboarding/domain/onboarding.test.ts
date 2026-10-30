import { describe, expect, it } from "vitest";
import {
  firstObjective,
  ONBOARDING_DRAFT,
  opens,
  SKIP_COOKIE,
  SKIP_MAX_ACCOUNTS,
  skipCookie,
  skippedBy,
  type Created,
} from "./onboarding";
import { checkDraft } from "@/modules/objectives/domain/newObjective";

const A = "3f1c2a9e-0d4b-4c3a-9b1e-7a2f5c6d8e01";
const B = "b7d0e4c2-51aa-4f0e-8c3d-2e9f1a6b7c02";

/** The value part of a cookie string. */
const valueOf = (cookie: string) =>
  cookie.split("; ")[0].slice(SKIP_COOKIE.length + 1);

describe("ONBOARDING_DRAFT", () => {
  it("is the design's defaults: every day, 45m, today, 4 weeks, weekly", () => {
    expect(ONBOARDING_DRAFT).toMatchObject({
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      hours: "0",
      minutes: "45",
      start: "today",
      length: "4",
      unit: "weeks",
      cadence: "weekly",
    });
  });

  it("is a draft New objective's checks accept once named", () => {
    const checked = checkDraft(
      { ...ONBOARDING_DRAFT, name: "n", why: "w", criteria: "c" },
      "2026-09-05",
      "Asia/Kolkata",
    );
    expect(checked.ok && checked.body).toMatchObject({
      starts_on: "2026-09-05",
      runs_for_days: 28,
      schedule: { minutes_per_planned_day: 45 },
    });
  });
});

describe("opens", () => {
  it("opens for an account with no objectives that hasn't skipped", () => {
    expect(opens({ objectives: 0, skipped: false })).toBe(true);
  });

  it("doesn't open once skipped", () => {
    expect(opens({ objectives: 0, skipped: true })).toBe(false);
  });

  it("doesn't open with any objective, in any status", () => {
    expect(opens({ objectives: 1, skipped: false })).toBe(false);
  });

  it("doesn't open when the objectives couldn't be read", () => {
    expect(opens({ objectives: "unknown", skipped: false })).toBe(false);
  });
});

describe("the skip cookie", () => {
  it("nobody has skipped without a cookie", () => {
    expect(skippedBy(undefined, A)).toBe(false);
    expect(skippedBy("", A)).toBe(false);
  });

  it("remembers the account that skipped, and only that one", () => {
    const value = valueOf(skipCookie(undefined, A, false));
    expect(skippedBy(value, A)).toBe(true);
    expect(skippedBy(value, B)).toBe(false);
  });

  it("adds a second account, newest first, and keeps the first", () => {
    const value = valueOf(
      skipCookie(valueOf(skipCookie(undefined, A, false)), B, false),
    );
    expect(value).toBe(`${B}.${A}`);
    expect(skippedBy(value, A)).toBe(true);
    expect(skippedBy(value, B)).toBe(true);
  });

  it("holds an account once, moved to the front when it skips again", () => {
    expect(valueOf(skipCookie(`${B}.${A}`, A, false))).toBe(`${A}.${B}`);
  });

  it("keeps the newest accounts when it is full", () => {
    const old = Array.from({ length: SKIP_MAX_ACCOUNTS }, (_, i) => `id-${i}`);
    const value = valueOf(skipCookie(old.join("."), A, false));
    const ids = value.split(".");
    expect(ids).toHaveLength(SKIP_MAX_ACCOUNTS);
    expect(ids[0]).toBe(A);
    expect(ids).not.toContain(`id-${SKIP_MAX_ACCOUNTS - 1}`);
    expect(ids).toContain("id-0");
  });

  it("reads a malformed value as nobody, and starts it again", () => {
    const bad = `${A}.<script>`;
    expect(skippedBy(bad, A)).toBe(false);
    expect(valueOf(skipCookie(bad, B, false))).toBe(B);
  });

  it("is site-wide, lasts a year, and is Secure on HTTPS", () => {
    expect(skipCookie(undefined, A, true)).toBe(
      `${SKIP_COOKIE}=${A}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
    );
    expect(skipCookie(undefined, A, false)).not.toContain("Secure");
  });
});

/** Sat 5 Sep 2026, four weeks, every day, 45m. */
const created: Created = {
  title: "Conversational English",
  schedule: {
    mode: "fixed",
    planned_weekdays: [1, 2, 3, 4, 5, 6, 7],
    minutes_per_planned_day: 45,
    label: "",
  },
  start_date: "2026-09-05",
  end_date: "2026-10-02",
  review_cadence: "weekly",
  upcoming_review_on: "2026-09-06",
};

describe("firstObjective", () => {
  it("reads one that starts today as the design does", () => {
    expect(firstObjective(created, "2026-09-05")).toEqual({
      starts: "today",
      plan: "Fixed · Every day · 45m a day · weekly reviews · Sat 5 Sep – Fri 2 Oct",
      tiles: [
        { label: "Today", value: "Day 1 of 28" },
        { label: "Planned today", value: "45m" },
        { label: "First review", value: "Sun 6 Sep" },
      ],
    });
  });

  it("names the day one that starts later starts, and what a day asks", () => {
    const later = firstObjective(
      {
        ...created,
        start_date: "2026-09-07",
        end_date: "2026-10-04",
        upcoming_review_on: "2026-09-13",
      },
      "2026-09-05",
    );
    expect(later.starts).toBe("Mon 7 Sep");
    expect(later.tiles).toEqual([
      { label: "Starts", value: "Mon 7 Sep" },
      { label: "Planned a day", value: "45m" },
      { label: "First review", value: "Sun 13 Sep" },
    ]);
  });

  it("says Off day when today isn't one of its days", () => {
    const weekdays = firstObjective(
      {
        ...created,
        schedule: { ...created.schedule, planned_weekdays: [5, 1, 2, 3, 4] },
      },
      "2026-09-05",
    );
    expect(weekdays.plan).toMatch(/^Fixed · Mon–Fri · /);
    expect(weekdays.tiles[1]).toEqual({
      label: "Planned today",
      value: "Off day",
    });
  });

  it("reads a Sunday as Sunday", () => {
    const sunday = (planned_weekdays: number[]) =>
      firstObjective(
        {
          ...created,
          schedule: { ...created.schedule, planned_weekdays },
          start_date: "2026-09-06",
        },
        "2026-09-06",
      ).tiles[1].value;
    expect(sunday([7])).toBe("45m");
    expect(sunday([1])).toBe("Off day");
  });

  it("lists days that aren't a run of three or more", () => {
    const days = (planned_weekdays: number[]) =>
      firstObjective(
        { ...created, schedule: { ...created.schedule, planned_weekdays } },
        "2026-09-05",
      ).plan.split(" · ")[1];
    expect(days([1, 3, 5])).toBe("Mon, Wed, Fri");
    expect(days([6, 7])).toBe("Sat, Sun");
    expect(days([6])).toBe("Sat");
  });

  it("reads a target over an hour, and monthly reviews", () => {
    const long = firstObjective(
      {
        ...created,
        schedule: { ...created.schedule, minutes_per_planned_day: 125 },
        review_cadence: "monthly",
      },
      "2026-09-05",
    );
    expect(long.plan).toContain("2h 05m a day · monthly reviews");
    expect(long.tiles[1].value).toBe("2h 05m");
  });

  it("reads a whole-hour target compactly, as the objective's page does", () => {
    const hour = firstObjective(
      {
        ...created,
        schedule: { ...created.schedule, minutes_per_planned_day: 120 },
      },
      "2026-09-05",
    );
    expect(hour.plan).toContain("· 2h a day ·");
    expect(hour.tiles[1].value).toBe("2h 00m");
  });

  it("shows the year of a plan that ends in another", () => {
    expect(
      firstObjective(
        { ...created, start_date: "2026-12-14", end_date: "2027-01-10" },
        "2026-12-14",
      ).plan,
    ).toMatch(/Mon 14 Dec – Sun 10 Jan 2027$/);
  });

  it("leaves out what the objective doesn't say", () => {
    const bare = firstObjective(
      {
        ...created,
        schedule: { ...created.schedule, planned_weekdays: undefined },
        review_cadence: undefined,
        upcoming_review_on: null,
      },
      "2026-09-05",
    );
    expect(bare.plan).toBe("Fixed · 45m a day · Sat 5 Sep – Fri 2 Oct");
    expect(bare.tiles[1].value).toBe("Off day");
    expect(bare.tiles[2]).toEqual({ label: "First review", value: "—" });
  });
});
