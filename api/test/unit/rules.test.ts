import { describe, expect, it } from "vitest";
import { analyzeWithRules, suggestCategories, type RuleInput } from "../../src/domain/analysis/rules";

const input = (title: string, overrides: Partial<RuleInput> = {}): RuleInput => ({ title, description: null, tags: [], language: "en", ...overrides });

describe("suggestCategories", () => {
  // Misfiles from the audit of 2026-09-13.
  it("reads the title before the description, so a NASA clip about blood samples is Science, not Painting", () => {
    const clip = input("Space Station Astronauts Collect Blood Samples for Science", {
      description: "Drawing blood is a regular part of life aboard the International Space Station.",
      source: "nasa_images",
    });
    expect(suggestCategories(clip)[0]).toBe("science");
    expect(suggestCategories(clip)).not.toContain("drawing_painting");
  });

  it("counts drawing as art only in art phrases", () => {
    expect(suggestCategories(input("Easy drawing for kids"))[0]).toBe("drawing_painting");
    expect(suggestCategories(input("Drawing blood at the clinic"))).not.toContain("drawing_painting");
  });

  it("falls back to the source's usual category, then to the description", () => {
    expect(suggestCategories(input("Apollo_11_Introduction_720p", { source: "nasa_images" }))).toEqual(["science"]);
    expect(suggestCategories(input("Kariyilapakshi (1)", { description: "Birds playing", source: "wikimedia_commons" }))).toEqual(["general_knowledge"]);
    expect(suggestCategories(input("Buckeye butterfly"))).toEqual(["general_knowledge"]);
  });

  it("files every picture book under Storybooks first, with its topic as a second category", () => {
    expect(suggestCategories(input("Counting Cats", { contentType: "STORYBOOK" }))).toEqual(["storybooks", "maths"]);
    expect(suggestCategories(input("Maria's Family", { contentType: "STORYBOOK" }), { category: "storybooks" })).toEqual(["storybooks"]);
    // From the re-curation dry run: "counts" isn't counting, and a book is never also Stories.
    expect(suggestCategories(input("Every Tree Counts", { contentType: "STORYBOOK" }))).toEqual(["storybooks", "general_knowledge"]);
    expect(suggestCategories(input("My Ten Friends", { contentType: "STORYBOOK", description: "This is a story about things we use at home." }))).toEqual(["storybooks"]);
  });

  it("never files a video under Storybooks, whatever the hint says", () => {
    expect(suggestCategories(input("Story time: Sharing is caring"), { category: "storybooks" })).toEqual(["stories"]);
  });

  it("puts the discovery hint first and keeps at most three categories", () => {
    const categories = suggestCategories(input("Counting song with animals and colours for kids"), { category: "maths" });
    expect(categories[0]).toBe("maths");
    expect(categories.length).toBeLessThanOrEqual(3);
  });
});

describe("analyzeWithRules", () => {
  it("flags a suspicious word for the AI to confirm instead of deciding itself", () => {
    const rules = analyzeWithRules(input("Pillow fight song"));
    expect(rules.flaggedCritical).toBe(true);
    expect(rules.criteria).toEqual([expect.objectContaining({ key: "physical_violence", result: "FAIL" })]);
    expect(rules.classification).toMatchObject({ category: "music_rhymes", categories: ["music_rhymes"] });
    expect(rules).not.toHaveProperty("skipAiReason");
  });
});
