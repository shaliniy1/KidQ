import { describe, expect, it } from "vitest";
import { breakPlan } from "../../src/domain/onboarding";
import { groupOf, parentCategoriesFrom } from "../../src/domain/parent-categories";
import { assembleSession, orderForSession, type SessionCandidate } from "../../src/domain/session";
import { energyBias, sessionContext, timeBand } from "../../src/domain/time-of-day";

// 5:30 IST is midnight UTC, so IST hh:mm is UTC (hh − 5):(mm − 30).
const ist = (hours: number, minutes = 0) => new Date(Date.UTC(2026, 8, 14, hours - 5, minutes - 30));

describe("parent categories", () => {
  const groups = parentCategoriesFrom([
    { key: "our_world", label: "Our World", active: true, meta: { includes: ["science", "general_knowledge"] } },
    { key: "stories_rhymes", label: "Stories & Rhymes", active: true, meta: { includes: ["stories", "storybooks"] } },
    { key: "retired", label: "Retired", active: false, meta: { includes: ["maths"] } },
  ]);
  it("rolls admin categories up to the parent group that covers them", () => {
    expect(groupOf(groups, "science")).toBe("our_world");
    expect(groupOf(groups, "storybooks")).toBe("stories_rhymes");
    expect(groupOf(groups, "maths")).toBeNull();
    expect(groupOf(groups, null)).toBeNull();
  });
});

describe("break interval", () => {
  it("makes one break per interval, rounded, with at least the wind-down", () => {
    expect(breakPlan(30, 10).total_breaks).toBe(3);
    expect(breakPlan(90, 15).total_breaks).toBe(6);
    expect(breakPlan(15, 20).total_breaks).toBe(1);
    expect(breakPlan(60)).toEqual({ total_breaks: 4, mid_session_breaks: 3, wind_down: true });
  });

  it("fills slots of the chosen interval", () => {
    const library = Array.from({ length: 12 }, (_, index): SessionCandidate => ({ id: `v${index}`, durationSeconds: 5 * 60, category: `c${index}`, calm: 70 }));
    const session = assembleSession(library, 30, { breakType: "ALTERNATE", calmEnding: false, intervalMinutes: 10 });
    expect(session.slots.map((slot) => slot.itemIds.length)).toEqual([2, 2, 2]);
    expect(session.slots.map((slot) => slot.breakAfter)).toEqual(["MOVEMENT", "QUIET", "WIND_DOWN"]);
  });
});

describe("time of day", () => {
  it("reads the band from India's clock", () => {
    expect([ist(7), ist(13), ist(17), ist(21), ist(2)].map(timeBand)).toEqual(["MORNING", "DAYTIME", "EVENING", "NIGHT", "NIGHT"]);
  });

  it("eases the energy bias across a band change instead of snapping", () => {
    expect(energyBias(ist(9))).toBe(1);
    expect(energyBias(ist(19))).toBe(-0.7);
    expect(energyBias(ist(18, 45))).toBeGreaterThan(-0.7);
    expect(energyBias(ist(18, 45))).toBeLessThan(-0.4);
    expect(energyBias(ist(20))).toBe(-1);
  });

  it("puts the parent's mode first, then a calming goal, then the clock", () => {
    expect(sessionContext(ist(15), "BEDTIME", false)).toMatchObject({ timeBand: "DAYTIME", opener: "NIGHT", contentMode: "BEDTIME", windDown: "SLEEP" });
    expect(sessionContext(ist(9), "AUTO", true)).toMatchObject({ opener: "MORNING", bias: 0, windDown: "CALM" });
    expect(sessionContext(ist(9), "AUTO", false)).toMatchObject({ bias: 1, windDown: "STANDARD" });
    // Late at night the session always ends on the sleep wind-down, even in Morning mode.
    expect(sessionContext(ist(22), "MORNING", false)).toMatchObject({ opener: "MORNING", windDown: "SLEEP" });
  });
});

describe("session ordering", () => {
  const video = (id: string, overrides: Partial<SessionCandidate> = {}): SessionCandidate => ({ id, durationSeconds: 300, category: id, calm: 70, ...overrides });

  it("at bedtime leaves out livelier videos while calm ones remain", () => {
    const order = orderForSession(
      [video("morning-only", { modes: ["MORNING"] }), video("frantic", { calm: 40 }), video("calm-untagged", { calm: 80 }), video("bedtime", { modes: ["BEDTIME"] })],
      { contentMode: "BEDTIME", bias: -1 },
    );
    expect(order.map((candidate) => candidate.id)).toEqual(["bedtime", "calm-untagged"]);
  });

  it("still plays something at bedtime when nothing calm is left", () => {
    expect(orderForSession([video("lively", { modes: ["MORNING"] })], { contentMode: "BEDTIME" }).map((candidate) => candidate.id)).toEqual(["lively"]);
  });

  it("moves the lean-toward group first without filtering anything out", () => {
    const order = orderForSession([video("story", { groups: ["stories_rhymes"] }), video("song", { groups: ["songs_music"] })], { leanToward: "songs_music" });
    expect(order.map((candidate) => candidate.id)).toEqual(["song", "story"]);
  });
});
