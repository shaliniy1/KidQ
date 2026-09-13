import { describe, expect, it } from "vitest";
import { agentOutputSchema, normalizeAgentOutput, responseSchema } from "../../src/ai/scoring-agent";
import type { StoryContent } from "../../src/connectors/types";
import { COMPONENTS, componentsFor } from "../../src/domain/scoring";
import { applyBounds, bookBounds, bookTextMetrics, observationBounds } from "../../src/domain/scoring/evidence";
import type { Taxonomy, TaxonomyKind } from "../../src/repositories/taxonomy";
import { agentOutput, storyAgentOutput } from "../fixtures/sources";

const term = (kind: TaxonomyKind, key: string) => ({ kind, key, label: key, sortOrder: 0, active: true, meta: {} });
const taxonomy: Taxonomy = {
  category: ["maths", "science", "music_rhymes", "storybooks"].map((key) => term("category", key)),
  interest: [term("interest", "numbers"), term("interest", "stories"), term("interest", "weather")],
  development_goal: [term("development_goal", "cognitive"), term("development_goal", "communication")],
  regulation_goal: [term("regulation_goal", "calm")],
  language: [],
  age_group: [],
};
const parse = (json: string) => agentOutputSchema.parse(JSON.parse(json));
const BOOK = { contentType: "STORYBOOK" };

describe("normalizeAgentOutput", () => {
  it("bounds scores by what the AI observed, and fails the check it contradicted", () => {
    const output = parse(agentOutput({ observations: { palette: "HARSH", flashing_moments: ["00:12"], cuts_per_minute: 25 } }));
    const { scores, criteria } = normalizeAgentOutput(output, taxonomy);
    const visual = scores.find((s) => s.component === "VISUAL_COMFORT");
    // 89 → 35: flashing (35) is tighter than the harsh palette (45); a correction that big lowers its certainty.
    expect(visual).toMatchObject({ value: 35, selfConfidence: 0.72 });
    expect(visual?.evidence).toContain("Capped at 35: flashing, harsh, neon or high-contrast colours.");
    expect(scores.find((s) => s.component === "PACING")?.value).toBe(55);
    expect(criteria.find((c) => c.key === "flashing_or_excessive_contrast")).toMatchObject({ result: "FAIL", timestamps: ["00:12"] });
  });

  it("leaves a calm review alone", () => {
    const { scores } = normalizeAgentOutput(parse(agentOutput()), taxonomy);
    expect(scores.map((s) => s.value)).toEqual([96, 78, 89, 87]);
  });

  it("fails developmental_mismatch for content made for adults", () => {
    const { criteria } = normalizeAgentOutput(parse(agentOutput({ observations: { intended_audience: "ADULTS" } })), taxonomy);
    expect(criteria.find((c) => c.key === "developmental_mismatch")).toMatchObject({ result: "FAIL", evidence: "Made for adults, not young children." });
  });

  it("never files a video under Storybooks, and files every picture book there first", () => {
    const video = normalizeAgentOutput(parse(agentOutput({ classification: { category: "storybooks", also_fits: ["maths"] } })), taxonomy);
    expect(video.classification).toMatchObject({ category: "maths", categories: ["maths"] });

    const book = normalizeAgentOutput(parse(agentOutput({ classification: { category: "maths", also_fits: ["science", "nonsense"] } })), taxonomy, componentsFor("STORYBOOK"), BOOK);
    expect(book.classification).toMatchObject({ category: "storybooks", categories: ["storybooks", "maths", "science"] });
  });

  it("measures a picture book's text: dense pages cap Reading pace and raise the youngest age", () => {
    const sentence = "The little elephant walked slowly through the tall green grass looking for her friends near the river";
    const page = (n: number) => ({ page: n, text: `${sentence}. ${sentence}. ${sentence}. ${sentence}. ${sentence}.`, image_url: null });
    const story = { pages: [1, 2, 3].map(page) } as StoryContent;
    const { scores, classification } = normalizeAgentOutput(parse(storyAgentOutput()), taxonomy, componentsFor("STORYBOOK"), { ...BOOK, story });
    expect(scores.find((s) => s.component === "PACING")?.value).toBe(65);
    expect(classification).toMatchObject({ ageMin: 5, ageMax: 6 });
  });
});

describe("responseSchema", () => {
  it("asks for observations and checks before scores, and evidence before each number", () => {
    const schema = JSON.parse(JSON.stringify(responseSchema(taxonomy, COMPONENTS)));
    expect(schema.propertyOrdering).toEqual(["observations", "criteria", "components", "classification", "learning_objective", "kidq_summary"]);
    expect(schema.properties.components.properties.PACING.propertyOrdering).toEqual(["evidence", "timestamps", "score", "self_confidence"]);
    expect(schema.properties.criteria.items.propertyOrdering).toEqual(["key", "evidence", "timestamps", "result"]);
    expect(schema.properties.classification.properties.category.enum).not.toContain("storybooks");
    expect(JSON.parse(JSON.stringify(responseSchema(taxonomy, componentsFor("STORYBOOK"), true))).properties.observations.required).toEqual([
      "palette",
      "clutter",
      "intended_audience",
    ]);
  });
});

describe("evidence rules", () => {
  it("caps bright colours and loud sound without failing a check", () => {
    const { bounds, fails } = observationBounds({ palette: "BRIGHT", loudness: "LOUD_SPIKY" });
    expect(bounds).toEqual([
      { component: "VISUAL_COMFORT", max: 75, reason: "bright, saturated colours" },
      { component: "AUDIO_COMFORT", max: 55, reason: "loud or spiky sound" },
    ]);
    expect(fails).toEqual([]);
  });

  it("measures reading load from page text", () => {
    const metrics = bookTextMetrics([{ text: "One two three." }, { text: "Four five six seven." }, { text: "" }]);
    expect(metrics).toEqual({ pages: 2, wordsPerPage: 3.5, wordsPerSentence: 3.5, longWordShare: 0 });
    expect(bookBounds(metrics)).toEqual({ bounds: [], minAge: null });
    expect(bookTextMetrics([])).toBeNull();
  });

  it("only ever lowers a score, to the tightest bound", () => {
    const score = { component: "PACING" as const, value: 60, status: "MEASURED" as const, selfConfidence: 0.9, evidence: "Calm.", timestamps: [] };
    expect(applyBounds([score], [{ component: "PACING", max: 70, reason: "x" }])).toEqual([score]);
    expect(applyBounds([score], [{ component: "PACING", max: 55, reason: "x" }, { component: "PACING", max: 40, reason: "y" }])[0]).toMatchObject({ value: 40, selfConfidence: 0.72 });
  });
});
