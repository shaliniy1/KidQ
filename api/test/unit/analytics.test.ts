import { describe, expect, it } from "vitest";
import { capActiveSeconds, localParts, partOfDay, periodRange, summarize, type Play } from "../../src/domain/analytics";

const TODAY = "2026-09-13";
const labels = { science: "Science", storybooks: "Storybooks", music_rhymes: "Music & rhymes" };
const play = (overrides: Partial<Play> = {}): Play => ({
  itemId: "v1",
  kind: "VIDEO",
  category: "science",
  day: TODAY,
  activeSeconds: 300,
  parts: { MORNING: 300, AFTERNOON: 0, EVENING: 0, OTHER: 0 },
  maxProgress: 100,
  completed: true,
  ...overrides,
});
const week = (plays: Play[]) => summarize(plays, { period: "7d", today: TODAY, labels });

describe("screen-time caps", () => {
  const at = (seconds: number) => new Date(Date.UTC(2026, 8, 13, 9, 0, seconds));
  it("never counts more than the wall-clock time since the play's previous event", () => {
    expect(capActiveSeconds({ reported: 500, occurredAt: at(20), lastEventAt: at(0), totalSoFar: 0, maxTotal: 1000 })).toBe(25);
    expect(capActiveSeconds({ reported: 12, occurredAt: at(20), lastEventAt: at(0), totalSoFar: 0, maxTotal: 1000 })).toBe(12);
  });
  it("stops at the play's limit", () => {
    expect(capActiveSeconds({ reported: 60, occurredAt: at(59), lastEventAt: at(0), totalSoFar: 200, maxTotal: 220 })).toBe(20);
  });
});

describe("local time", () => {
  it("uses the parent's time zone for the day and part of the day", () => {
    const lateUtc = new Date("2026-09-13T20:00:00Z");
    expect(localParts(lateUtc, "Asia/Kolkata")).toEqual({ day: "2026-09-14", hour: 1 });
    expect(localParts(lateUtc, "UTC")).toEqual({ day: "2026-09-13", hour: 20 });
    expect([9, 13, 18, 22].map(partOfDay)).toEqual(["MORNING", "AFTERNOON", "EVENING", "OTHER"]);
    expect(periodRange("7d", TODAY)).toMatchObject({ start: "2026-09-07", previousStart: "2026-08-31", previousEnd: "2026-09-06" });
  });
});

describe("summarize", () => {
  it("sorts plays into completed, partly watched and stopped early", () => {
    const summary = week([play(), play({ completed: false, maxProgress: 60 }), play({ completed: false, maxProgress: 10 })]);
    expect(summary.completion).toEqual({ started: 3, completed: 1, partly_watched: 1, stopped_early: 1 });
  });

  it("needs two plays before a category counts as engaging, and weighs more than time alone", () => {
    const summary = week([
      // One long open of Music: the most time, but a single play.
      play({ itemId: "m1", category: "music_rhymes", activeSeconds: 3000 }),
      // Science and Storybooks get the same time; Science is finished and rewatched, Storybooks isn't.
      play({ itemId: "s1", category: "science", activeSeconds: 600 }),
      play({ itemId: "s1", category: "science", activeSeconds: 600 }),
      play({ itemId: "s2", category: "science", activeSeconds: 600 }),
      play({ itemId: "b1", category: "storybooks", activeSeconds: 900, completed: false, maxProgress: 30 }),
      play({ itemId: "b2", category: "storybooks", activeSeconds: 900, completed: false, maxProgress: 30 }),
    ]);
    expect(summary.engaged.map((entry) => entry.key)).toEqual(["science", "storybooks"]);
    expect(summary.engaged[0]).toEqual({ key: "science", label: "Science", minutes: 30, videos: 2, activities: 0, average_completion: 100 });
    expect(summary.categories[0]).toMatchObject({ key: "music_rhymes", label: "Music & rhymes", minutes: 50 });
  });

  it("counts times watched and keeps the previous period for comparison", () => {
    const summary = week([play(), play(), play({ itemId: "v2" }), play({ day: "2026-09-05", activeSeconds: 1200 })]);
    expect(summary.top[0]).toEqual({ item_id: "v1", minutes: 10, completion: 100, times_watched: 2 });
    expect(summary.overview).toMatchObject({ screen_minutes: 15, videos_watched: 2, vs_previous: { minutes_diff: -5, compared_with: "the week before" } });
    expect(summary.daily).toHaveLength(7);
    expect(summary.daily.at(-1)).toEqual({ date: TODAY, minutes: 15 });
  });

  it("says nothing until there's enough, then only facts", () => {
    expect(week([play(), play({ itemId: "v2" })]).insights).toEqual([]);
    const summary = week([play(), play({ itemId: "v2" }), play({ itemId: "v3", completed: false, maxProgress: 40 })]);
    expect(summary.insights).toEqual(["Seems to be engaging most with Science this week.", "Finished 2 of the 3 videos they started."]);
  });

  it("splits videos from activities, and activity time isn't screen time", () => {
    const summary = week([play(), play({ kind: "ACTIVITY", itemId: "a1", category: "art_craft", activeSeconds: 900 })]);
    expect(summary.split).toEqual({ video_minutes: 5, activity_minutes: 15, video_percent: 25, activity_percent: 75 });
    expect(summary.overview).toMatchObject({ screen_minutes: 5, activities_completed: 1 });
  });
});
