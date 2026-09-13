import { describe, expect, it } from "vitest";
import { assembleSession, sessionMinutes, type SessionCandidate } from "../../src/domain/session";

let counter = 0;
const video = (minutes: number, overrides: Partial<SessionCandidate> = {}): SessionCandidate => {
  counter += 1;
  return { id: `v${counter}`, durationSeconds: minutes * 60, category: `category-${counter}`, calm: 50, ...overrides };
};
const plenty = () => Array.from({ length: 40 }, () => video(7));
const alternate = { breakType: "ALTERNATE" as const, calmEnding: false };

describe("assembleSession", () => {
  it("makes one ~15-minute slot per break, ending with the wind-down", () => {
    expect(assembleSession(plenty(), 90, alternate).slots.map((slot) => slot.breakAfter)).toEqual(["MOVEMENT", "QUIET", "MOVEMENT", "QUIET", "MOVEMENT", "WIND_DOWN"]);
    expect(assembleSession(plenty(), 15, alternate).slots.map((slot) => slot.breakAfter)).toEqual(["WIND_DOWN"]);
    expect(assembleSession(plenty(), 45, { breakType: "QUIET", calmEnding: false }).slots.map((slot) => slot.breakAfter)).toEqual(["QUIET", "QUIET", "WIND_DOWN"]);
  });

  it("fills with whole videos only, a few minutes over at most", () => {
    const session = assembleSession(plenty(), 30, alternate);
    // Two 7-minute videos make 14 minutes; a third would end at 21, past the 18-minute limit.
    expect(session.slots.map((slot) => slot.itemIds.length)).toEqual([2, 2]);
    expect(session.shortByMinutes).toBe(0);
  });

  it("gives a long video a slot of its own rather than cutting it", () => {
    const long = video(22);
    const session = assembleSession([long, video(5), video(5)], 30, alternate);
    expect(session.slots[0].itemIds).toEqual([long.id]);
  });

  it("never plays one category twice in a row while another is left", () => {
    const books = [video(5, { category: "storybooks" }), video(5, { category: "storybooks" })];
    const song = video(5, { category: "music_rhymes" });
    const order = assembleSession([...books, song], 15, alternate).slots.flatMap((slot) => slot.itemIds);
    expect(order).toEqual([books[0].id, song.id, books[1].id]);
  });

  it("ends on the calmest videos when the child needs calming", () => {
    const lively = Array.from({ length: 4 }, () => video(7, { calm: 40 }));
    const calm = video(7, { calm: 95 });
    const session = assembleSession([...lively, calm], 30, { breakType: "ALTERNATE", calmEnding: true });
    expect(session.slots[1].itemIds[0]).toBe(calm.id);
  });

  it("runs as long as a short library allows and says by how much it fell short", () => {
    const session = assembleSession([video(5), video(5)], 30, alternate);
    expect(session.slots).toHaveLength(1);
    expect(session.slots[0].breakAfter).toBe("WIND_DOWN");
    expect(session.shortByMinutes).toBe(20);
    expect(assembleSession([], 30, alternate)).toMatchObject({ slots: [], shortByMinutes: 30 });
  });

  it("never repeats a video within one session", () => {
    const ids = assembleSession(plenty(), 90, alternate).slots.flatMap((slot) => slot.itemIds);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("sessionMinutes", () => {
  it("keeps presets and snaps custom lengths to 30-minute blocks", () => {
    expect([15, 30, 45, 60, 90].map(sessionMinutes)).toEqual([15, 30, 45, 60, 90]);
    expect([20, 100, 130].map(sessionMinutes)).toEqual([30, 90, 120]);
  });
});
