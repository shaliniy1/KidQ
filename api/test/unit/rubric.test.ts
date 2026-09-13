import { describe, expect, it } from "vitest";
import { CRITICAL_KEYS, EXCLUDE_KEYS, RUBRIC } from "../../src/domain/rubric";

// Copied from docs/content-curation/README.md ("Filter-out criteria" / "Filter-in criteria").
const README_FILTER_OUT = [
  "rapid_visual_cuts", "flashing_or_excessive_contrast", "loud_or_jarring_audio", "cluttered_visuals",
  "physical_violence", "verbal_or_emotional_aggression", "frightening_imagery", "mature_themes",
  "discrimination_or_stereotypes", "direct_advertising", "product_placement", "unboxing_or_toy_review",
  "franchise_led_promotion", "endless_or_open_loop", "clickbait_title_or_thumbnail",
  "repetitive_without_objective", "passive_viewing_only", "developmental_mismatch",
];
const README_FILTER_IN = [
  "clear_learning_objective", "vocabulary_in_context", "problem_solving_narrative", "fine_motor_prompt",
  "gross_motor_prompt", "slow_deliberate_pacing", "gentle_soothing_audio", "simple_uncluttered_visuals",
  "predictable_structure", "empathy_and_kindness", "emotional_literacy", "diversity_and_inclusion",
  "constructive_conflict_resolution", "participation_prompts", "meaningful_touch_interaction",
  "open_ended_questions", "craft_or_diy_extension", "nature_exploration_extension",
  "imaginative_play_extension", "age_band_fit",
];

const keysIn = (group: string) => RUBRIC.filter((c) => c.group === group).map((c) => c.key);

describe("rubric registry", () => {
  it("covers every criterion in the content-curation README", () => {
    expect(keysIn("FILTER_OUT")).toEqual(expect.arrayContaining(README_FILTER_OUT));
    expect(keysIn("FILTER_IN").sort()).toEqual([...README_FILTER_IN].sort());
  });

  it("adds only dangerous_behaviour beyond the README (rubric v2)", () => {
    expect(keysIn("FILTER_OUT").filter((key) => !README_FILTER_OUT.includes(key))).toEqual(["dangerous_behaviour"]);
  });

  it("has unique keys", () => {
    expect(new Set(RUBRIC.map((c) => c.key)).size).toBe(RUBRIC.length);
  });

  it("treats the scoring MD's hard-safety items as critical", () => {
    expect([...CRITICAL_KEYS].sort()).toEqual([
      "dangerous_behaviour",
      "discrimination_or_stereotypes",
      "frightening_imagery",
      "mature_themes",
      "physical_violence",
      "verbal_or_emotional_aggression",
    ]);
  });

  it("gives every filter-out criterion a tier: safety withholds, exclude rejects, flag only shows", () => {
    expect(RUBRIC.filter((c) => c.group === "FILTER_OUT").every((c) => c.tier !== null && c.area === null)).toBe(true);
    expect([...EXCLUDE_KEYS].sort()).toEqual([
      "developmental_mismatch",
      "direct_advertising",
      "endless_or_open_loop",
      "flashing_or_excessive_contrast",
      "franchise_led_promotion",
      "loud_or_jarring_audio",
      "rapid_visual_cuts",
      "unboxing_or_toy_review",
    ]);
    expect(RUBRIC.filter((c) => c.critical).every((c) => c.tier === "SAFETY")).toBe(true);
  });

  it("counts every filter-in criterion toward a learning area, except the comfort ones the score covers", () => {
    const noArea = RUBRIC.filter((c) => c.group === "FILTER_IN" && c.area === null).map((c) => c.key).sort();
    expect(noArea).toEqual(["age_band_fit", "gentle_soothing_audio", "simple_uncluttered_visuals", "slow_deliberate_pacing"]);
    expect(new Set(RUBRIC.flatMap((c) => (c.area ? [c.area] : [])))).toEqual(new Set(["THINKING", "LANGUAGE", "FEELINGS", "DOING"]));
  });

  it("marks the README evidence-boundary criteria as audiovisual-only", () => {
    const audiovisual = RUBRIC.filter((c) => c.requiresAudiovisual).map((c) => c.key).sort();
    expect(audiovisual).toEqual([
      "cluttered_visuals",
      "flashing_or_excessive_contrast",
      "frightening_imagery",
      "gentle_soothing_audio",
      "loud_or_jarring_audio",
      "rapid_visual_cuts",
      "simple_uncluttered_visuals",
      "slow_deliberate_pacing",
    ]);
  });
});
