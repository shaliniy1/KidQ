import { describe, expect, it } from "vitest";
import { ageBandsFor, ageFromBand, bandForAge } from "../../src/domain/age";
import { breakPlan, DEFAULT_DEVELOPMENT_GOALS, defaultSessionMinutes } from "../../src/domain/onboarding";

describe("age bands", () => {
  it("tags content with every band its age range touches", () => {
    expect(ageBandsFor(2, 6)).toEqual(["2_3", "3_4", "4_5", "5_6"]);
    expect(ageBandsFor(0, 2)).toEqual(["0_2"]);
    expect(ageBandsFor(3, 3)).toEqual(["2_3", "3_4"]);
    expect(ageBandsFor(null, 4)).toEqual([]);
  });

  it("estimates today's age from the band a parent picked, and moves the child up as time passes", () => {
    const setOn = new Date(Date.UTC(2026, 8, 12));
    expect(ageFromBand("3_4", setOn, setOn)).toBe(3.5);
    const yearLater = new Date(Date.UTC(2027, 8, 12));
    expect(ageFromBand("3_4", setOn, yearLater)).toBe(4.5);
    expect(bandForAge(ageFromBand("3_4", setOn, yearLater))).toBe("4_5");
    expect(ageFromBand("5_6", setOn, new Date(Date.UTC(2030, 0, 1)))).toBe(6);
    expect([1, 2, 5.5, 6].map(bandForAge)).toEqual(["0_2", "2_3", "5_6", "5_6"]);
  });
});

describe("onboarding defaults", () => {
  it("fills in development goals and session length from the age band", () => {
    expect(DEFAULT_DEVELOPMENT_GOALS["0_2"]).toEqual(["motor_skills", "communication", "emotional"]);
    expect(DEFAULT_DEVELOPMENT_GOALS["5_6"]).toEqual(["cognitive", "problem_solving", "learning"]);
    expect(defaultSessionMinutes("2_3")).toBe(15);
    expect(defaultSessionMinutes("3_4")).toBe(30);
  });

  it("plans one break per 15 minutes, ending with the wind-down", () => {
    expect([15, 30, 45, 60, 90].map((minutes) => breakPlan(minutes))).toEqual([
      { total_breaks: 1, mid_session_breaks: 0, wind_down: true },
      { total_breaks: 2, mid_session_breaks: 1, wind_down: true },
      { total_breaks: 3, mid_session_breaks: 2, wind_down: true },
      { total_breaks: 4, mid_session_breaks: 3, wind_down: true },
      { total_breaks: 6, mid_session_breaks: 5, wind_down: true },
    ]);
  });
});
