import { describe, expect, it } from "vitest";
import { prescreen, type PrescreenInput } from "../../src/domain/analysis/prescreen";

const video = (title: string, overrides: Partial<PrescreenInput> = {}): PrescreenInput => ({
  contentType: "VIDEO",
  title,
  description: null,
  tags: [],
  durationSeconds: 120,
  ...overrides,
});
const code = (input: PrescreenInput) => {
  const result = prescreen(input);
  return result.ok ? "ok" : result.code;
};

describe("prescreen", () => {
  // Every one of these reached the library before the pre-screen existed (audit of 2026-09-13).
  it("drops the unsuitable and off-topic items the audit found", () => {
    expect(code(video("The Birds trailer (1963)"))).toBe("REJECTED_UNSUITABLE");
    expect(code(video("Duck out of Water — An Animal Liberation Exposè (edited)"))).toBe("REJECTED_UNSUITABLE");
    expect(code(video("Butterfly stroke from above", { description: "Person swimming butterfly filmed from above" }))).toBe("REJECTED_OFF_TOPIC");
  });

  it("drops agency news, briefings, promos and b-roll", () => {
    expect(code(video("Our next Mars Rover gets closer to launch on This Week @NASA – July 10"))).toBe("REJECTED_NEWS");
    expect(code(video("NASA TV Video File Package-NASA Announces Mars 2020 Rover Name & Naming Contest"))).toBe("REJECTED_NEWS");
    expect(code(video("Orion_Artemis-I_animation_b-roll_9_2021_FS"))).toBe("REJECTED_NEWS");
    expect(code(video("Sun-Earth Day 2009 Promo 1"))).toBe("REJECTED_NEWS");
    expect(code(video("NASA Science Live: Landsat - A Legacy of Seeing Earth from Space"))).toBe("REJECTED_NEWS");
  });

  it("drops discovered videos that are too short or too long for a session", () => {
    expect(code(video("Fish at Monterey Bay Aquarium 3 2024-01-11", { durationSeconds: 6 }))).toBe("REJECTED_TOO_SHORT");
    expect(code(video("Earth from Space in 4K – Expedition 65 Edition", { durationSeconds: 3000 }))).toBe("REJECTED_TOO_LONG");
    expect(code(video("Is There Weather on the Moon", { durationSeconds: null }))).toBe("ok");
  });

  it("keeps harmless look-alikes", () => {
    expect(code(video("Tractor trailer song for kids"))).toBe("ok");
    expect(code(video("Buckeye butterfly", { durationSeconds: 189 }))).toBe("ok");
    expect(code(video("Calm counting song", { description: "Use promo code KIDS for our shop." }))).toBe("ok");
    expect(code(video("Will the Sun Ever Burn Out | We Asked a NASA Expert", { durationSeconds: 79 }))).toBe("ok");
  });

  it("applies the length limits to videos only", () => {
    expect(code({ ...video("Rain, Rain"), contentType: "STORYBOOK", durationSeconds: 5 })).toBe("ok");
  });
});
