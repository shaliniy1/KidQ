import { describe, expect, it } from "vitest";
import {
  computeKidqScore,
  publishBlockers,
  type AssessmentInput,
  type AssessorType,
  type Component,
  type CriterionInput,
  type ScoringConfig,
} from "../../src/domain/scoring";

const config: ScoringConfig = {
  version: "KIDQ_SCORE_V1",
  weights: { CONTENT_LANGUAGE: 0.4, PACING: 0.25, VISUAL_COMFORT: 0.2, AUDIO_COMFORT: 0.15 },
  sourceReliability: { HUMAN: 1, MODEL: 0.8, RULE: 0.5 },
  minAiConfidence: 0.5,
};

let clock = 0;
function assessment(
  assessorType: AssessorType,
  scores: Partial<Record<Component, number>>,
  options: { criteria?: CriterionInput[]; selfConfidence?: number } = {},
): AssessmentInput {
  clock += 1;
  return {
    id: `${assessorType}-${clock}`,
    assessorType,
    createdAt: new Date(Date.UTC(2026, 8, 12, 0, clock)),
    scores: Object.entries(scores).map(([component, value]) => ({
      component: component as Component,
      value: value ?? null,
      status: "MEASURED" as const,
      selfConfidence: options.selfConfidence ?? 0.9,
      evidence: `${component} evidence`,
      timestamps: [],
    })),
    criteria: options.criteria ?? [],
  };
}

const allFour = (value: number) => ({ CONTENT_LANGUAGE: value, PACING: value, VISUAL_COMFORT: value, AUDIO_COMFORT: value });

describe("computeKidqScore", () => {
  it("applies the 40/25/20/15 formula and source reliability (API contract example)", () => {
    const result = computeKidqScore(
      [
        assessment("MODEL", { CONTENT_LANGUAGE: 96, PACING: 70, VISUAL_COMFORT: 89, AUDIO_COMFORT: 87 }),
        assessment("HUMAN", { PACING: 78 }),
      ],
      config,
    );
    expect(result.score).toBe(88.8);
    expect(result.confidence).toBe(0.85);
    expect(result.components.find((c) => c.component === "PACING")?.source).toBe("HUMAN");
    expect(result.missing).toEqual([]);
  });

  it("renormalises over measured components and says what is missing", () => {
    const result = computeKidqScore([assessment("MODEL", { CONTENT_LANGUAGE: 80 })], config);
    expect(result.score).toBe(80);
    expect(result.confidence).toBe(0.32);
    expect(result.missing).toHaveLength(3);
    expect(result.reason).toContain("Pacing analysis unavailable");
  });

  it("prefers HUMAN over MODEL over RULE, and the newest within one type", () => {
    const newestModel = computeKidqScore(
      [assessment("RULE", { PACING: 10 }), assessment("MODEL", { PACING: 40 }), assessment("MODEL", { PACING: 60 })],
      config,
    );
    expect(newestModel.components.find((c) => c.component === "PACING")?.value).toBe(60);

    const olderHuman = computeKidqScore([assessment("HUMAN", { PACING: 90 }), assessment("MODEL", { PACING: 20 })], config);
    expect(olderHuman.components.find((c) => c.component === "PACING")?.value).toBe(90);
  });

  it("withholds the score on a critical flag until a human resolves it", () => {
    const flagged = assessment("MODEL", allFour(95), {
      criteria: [{ key: "physical_violence", result: "FAIL", evidence: "A character hits another at 01:12.", timestamps: ["01:12"] }],
    });
    const blocked = computeKidqScore([flagged], config);
    expect(blocked.blockedBySafety).toBe(true);
    expect(blocked.score).toBeNull();
    expect(blocked.safetyFlags[0]).toMatchObject({ key: "physical_violence", timestamps: ["01:12"] });
    expect(blocked.reason).toContain("physical violence");

    const cleared = assessment("HUMAN", {}, {
      criteria: [{ key: "physical_violence", result: "PASS", evidence: "Playful pillow fight; nobody is hurt.", timestamps: [] }],
    });
    const resolved = computeKidqScore([flagged, cleared], config);
    expect(resolved.blockedBySafety).toBe(false);
    expect(resolved.score).toBe(95);
  });

  it("flags AI components below the confidence threshold", () => {
    const result = computeKidqScore([assessment("MODEL", allFour(90), { selfConfidence: 0.3 })], config);
    expect(result.lowConfidence).toEqual(["CONTENT_LANGUAGE", "PACING", "VISUAL_COMFORT", "AUDIO_COMFORT"]);
  });

  it("scores a picture book on its three applicable components", () => {
    const result = computeKidqScore([assessment("MODEL", { CONTENT_LANGUAGE: 90, PACING: 80, VISUAL_COMFORT: 70 })], config, "STORYBOOK");
    expect(result.components.map((c) => c.label)).toEqual(["Content & language", "Reading pace", "Illustrations"]);
    // (0.40×90 + 0.25×80 + 0.20×70) / 0.85 — audio doesn't apply, so it's neither weighted nor missing.
    expect(result.score).toBe(82.4);
    expect(result.confidence).toBe(0.8);
    expect(result.missing).toEqual([]);
  });

  it("returns no score when nothing was measured", () => {
    const result = computeKidqScore([], config);
    expect(result.score).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.reason).toBe("Not scored yet: no analysis is available.");
  });
});

describe("publishBlockers", () => {
  const tagged = { ageMin: 2, ageMax: 4, category: "maths", developmentGoals: ["cognitive"], regulationGoals: [] };

  it("is empty when scored, tagged and playable", () => {
    const score = computeKidqScore([assessment("MODEL", allFour(85))], config);
    expect(publishBlockers(score, tagged, { available: true, embeddable: true })).toEqual([]);
  });

  it("lists every missing piece", () => {
    const score = computeKidqScore([assessment("MODEL", { CONTENT_LANGUAGE: 90 })], config);
    const untagged = { ageMin: null, ageMax: null, category: null, developmentGoals: [], regulationGoals: [] };
    expect(publishBlockers(score, untagged, { available: false, embeddable: null })).toEqual([
      "MISSING_COMPONENTS",
      "MISSING_AGE",
      "MISSING_CATEGORY",
      "MISSING_GOAL",
      "NOT_PLAYABLE",
    ]);
  });

  it("blocks on a critical flag", () => {
    const score = computeKidqScore(
      [assessment("MODEL", allFour(90), { criteria: [{ key: "mature_themes", result: "FAIL", evidence: "Adult joke.", timestamps: [] }] })],
      config,
    );
    expect(publishBlockers(score, tagged, { available: true, embeddable: true })).toEqual(["CRITICAL_FLAG"]);
  });
});
