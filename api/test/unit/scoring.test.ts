import { describe, expect, it } from "vitest";
import {
  computeKidqScore,
  publishBlockers,
  rejectionFindings,
  type AssessmentInput,
  type AssessorType,
  type Component,
  type CriterionInput,
  type ScoringConfig,
} from "../../src/domain/scoring";

const config: ScoringConfig = {
  version: "KIDQ_SCORE_V2",
  weights: { CONTENT_LANGUAGE: 0.4, PACING: 0.25, VISUAL_COMFORT: 0.2, AUDIO_COMFORT: 0.15 },
  sourceReliability: { HUMAN: 1, MODEL: 0.8, RULE: 0.5 },
  minAiConfidence: 0.6,
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

const criterion = (key: string, result: CriterionInput["result"], timestamps: string[] = []): CriterionInput => ({ key, result, evidence: `${key} evidence`, timestamps });
// Every check the AI can answer only by watching and listening, all answered: a full review.
const SEEN = [
  "rapid_visual_cuts",
  "flashing_or_excessive_contrast",
  "loud_or_jarring_audio",
  "cluttered_visuals",
  "frightening_imagery",
  "slow_deliberate_pacing",
  "gentle_soothing_audio",
  "simple_uncluttered_visuals",
].map((key) => criterion(key, "PASS"));
const BOOK_SEEN = ["flashing_or_excessive_contrast", "cluttered_visuals", "frightening_imagery", "simple_uncluttered_visuals"].map((key) => criterion(key, "PASS"));
const seenExcept = (failing: CriterionInput) => [...SEEN.filter((c) => c.key !== failing.key), failing];

const allFour = (value: number) => ({ CONTENT_LANGUAGE: value, PACING: value, VISUAL_COMFORT: value, AUDIO_COMFORT: value });
const tagged = { ageMin: 2, ageMax: 4, category: "maths", developmentGoals: ["cognitive"], regulationGoals: [] };
const playable = { available: true, embeddable: true };

describe("computeKidqScore", () => {
  it("applies the 40/25/20/15 formula, with the admin's value winning (API contract example)", () => {
    const result = computeKidqScore(
      [assessment("MODEL", { CONTENT_LANGUAGE: 96, PACING: 70, VISUAL_COMFORT: 89, AUDIO_COMFORT: 87 }, { criteria: SEEN }), assessment("HUMAN", { PACING: 78 })],
      config,
    );
    expect(result.score).toBe(88.8);
    // AI parts: 0.75 × 0.8 reliability × 0.9 certainty; the admin's pacing: 0.25 × 1.
    expect(result.confidence).toBe(0.79);
    expect(result.components.find((c) => c.component === "PACING")?.source).toBe("HUMAN");
    expect(result.missing).toEqual([]);
  });

  it("renormalises over measured components and says what is missing", () => {
    const result = computeKidqScore([assessment("MODEL", { CONTENT_LANGUAGE: 80 }, { criteria: SEEN })], config);
    expect(result.score).toBe(80);
    expect(result.confidence).toBe(0.288);
    expect(result.missing).toHaveLength(3);
    expect(result.reason).toContain("Pacing analysis unavailable");
  });

  it("makes confidence reflect how sure the AI was and whether it answered the sight and sound checks", () => {
    const fullReview = computeKidqScore([assessment("MODEL", allFour(90), { criteria: SEEN })], config);
    const noChecks = computeKidqScore([assessment("MODEL", allFour(90))], config);
    const unsure = computeKidqScore([assessment("MODEL", allFour(90), { criteria: SEEN, selfConfidence: 0.6 })], config);
    const admin = computeKidqScore([assessment("HUMAN", allFour(90))], config);
    expect(fullReview.confidence).toBe(0.72);
    expect(noChecks.confidence).toBe(0.504);
    expect(unsure.confidence).toBe(0.48);
    expect(admin.confidence).toBe(1);
    expect([fullReview, noChecks, unsure, admin].map((r) => r.belowConfidence)).toEqual([false, true, true, false]);
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

  it("keeps a definite answer over an UNKNOWN from a higher assessor", () => {
    const rule = assessment("RULE", {}, { criteria: [criterion("frightening_imagery", "FAIL")] });
    expect(computeKidqScore([rule, assessment("MODEL", allFour(90), { criteria: [criterion("frightening_imagery", "UNKNOWN")] })], config).blockedBySafety).toBe(true);
    expect(computeKidqScore([rule, assessment("MODEL", allFour(90), { criteria: [criterion("frightening_imagery", "PASS")] })], config).blockedBySafety).toBe(false);
  });

  it("withholds the score on a critical flag until a human resolves it", () => {
    const flagged = assessment("MODEL", allFour(95), { criteria: [criterion("physical_violence", "FAIL", ["01:12"])] });
    const blocked = computeKidqScore([flagged], config);
    expect(blocked.blockedBySafety).toBe(true);
    expect(blocked.score).toBeNull();
    expect(blocked.safetyFlags[0]).toMatchObject({ key: "physical_violence", timestamps: ["01:12"] });
    expect(blocked.reason).toContain("physical violence");

    const cleared = assessment("HUMAN", {}, { criteria: [criterion("physical_violence", "PASS")] });
    const resolved = computeKidqScore([flagged, cleared], config);
    expect(resolved.blockedBySafety).toBe(false);
    expect(resolved.score).toBe(95);
  });

  it("caps the part of the score a failed check is about, but never an admin's value", () => {
    const fastCuts = criterion("rapid_visual_cuts", "FAIL", ["00:20"]);
    const ai = computeKidqScore([assessment("MODEL", { ...allFour(90), PACING: 85 }, { criteria: seenExcept(fastCuts) })], config);
    const pacing = ai.components.find((c) => c.component === "PACING");
    expect(pacing).toMatchObject({ value: 50, cap: { criterion: "rapid_visual_cuts", max: 50 } });
    expect(ai.score).toBe(80);
    expect(ai.reason).toContain("Capped: pacing at 50 (rapid visual cuts)");
    expect(ai.exclusions.map((flag) => flag.key)).toEqual(["rapid_visual_cuts"]);

    const adminPacing = computeKidqScore([assessment("MODEL", allFour(90), { criteria: seenExcept(fastCuts) }), assessment("HUMAN", { PACING: 85 })], config);
    expect(adminPacing.components.find((c) => c.component === "PACING")).toMatchObject({ value: 85, cap: null });
  });

  it("measures learning value from the filter-in checks, apart from the score", () => {
    const result = computeKidqScore(
      [
        assessment("MODEL", allFour(90), {
          criteria: [
            ...SEEN,
            criterion("clear_learning_objective", "PASS"),
            criterion("participation_prompts", "PASS"),
            criterion("empathy_and_kindness", "FAIL"),
            criterion("vocabulary_in_context", "UNKNOWN"),
          ],
        }),
      ],
      config,
    );
    expect(result.learning).toEqual({ value: 50, areas: ["THINKING", "DOING"] });
    expect(result.score).toBe(90);
    expect(computeKidqScore([assessment("MODEL", allFour(90), { criteria: SEEN })], config).learning).toEqual({ value: null, areas: [] });
  });

  it("flags AI components below the confidence threshold", () => {
    const result = computeKidqScore([assessment("MODEL", allFour(90), { selfConfidence: 0.3 })], config);
    expect(result.lowConfidence).toEqual(["CONTENT_LANGUAGE", "PACING", "VISUAL_COMFORT", "AUDIO_COMFORT"]);
  });

  it("scores a picture book on its three applicable components", () => {
    const result = computeKidqScore([assessment("MODEL", { CONTENT_LANGUAGE: 90, PACING: 80, VISUAL_COMFORT: 70 }, { criteria: BOOK_SEEN })], config, "STORYBOOK");
    expect(result.components.map((c) => c.label)).toEqual(["Content & language", "Reading pace", "Illustrations"]);
    // (0.40×90 + 0.25×80 + 0.20×70) / 0.85 — audio doesn't apply, so it's neither weighted nor missing.
    expect(result.score).toBe(82.4);
    expect(result.confidence).toBe(0.72);
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
  const blockersFor = (assessments: AssessmentInput[]) => publishBlockers(computeKidqScore(assessments, config), tagged, playable);

  it("is empty when scored 70 or more, sure, tagged and playable", () => {
    expect(blockersFor([assessment("MODEL", allFour(85), { criteria: SEEN })])).toEqual([]);
  });

  it("sends a score of 60–69 for a look and marks one under 60", () => {
    expect(blockersFor([assessment("MODEL", allFour(65), { criteria: SEEN })])).toEqual(["BORDERLINE_SCORE"]);
    expect(blockersFor([assessment("MODEL", allFour(55), { criteria: SEEN })])).toEqual(["LOW_SCORE"]);
  });

  it("blocks on a confirmed exclusion and on low confidence", () => {
    expect(blockersFor([assessment("MODEL", allFour(90), { criteria: seenExcept(criterion("loud_or_jarring_audio", "FAIL")) })])).toEqual(["EXCLUDED"]);
    expect(blockersFor([assessment("MODEL", allFour(90), { criteria: SEEN, selfConfidence: 0.6 })])).toEqual(["LOW_AI_CONFIDENCE"]);
  });

  it("lists every missing piece", () => {
    const score = computeKidqScore([assessment("MODEL", { CONTENT_LANGUAGE: 90 }, { criteria: SEEN })], config);
    const untagged = { ageMin: null, ageMax: null, category: null, developmentGoals: [], regulationGoals: [] };
    expect(publishBlockers(score, untagged, { available: false, embeddable: null })).toEqual([
      "MISSING_COMPONENTS",
      "LOW_AI_CONFIDENCE",
      "MISSING_AGE",
      "MISSING_CATEGORY",
      "MISSING_GOAL",
      "NOT_PLAYABLE",
    ]);
  });

  it("blocks on a critical flag", () => {
    expect(blockersFor([assessment("MODEL", allFour(90), { criteria: [...SEEN, criterion("mature_themes", "FAIL")] })])).toEqual(["CRITICAL_FLAG"]);
  });
});

describe("rejectionFindings", () => {
  it("rejects on problems the AI or an admin confirmed, and on a score under 60", () => {
    const flashing = computeKidqScore([assessment("MODEL", allFour(90), { criteria: seenExcept(criterion("flashing_or_excessive_contrast", "FAIL", ["00:12"])) })], config);
    expect(rejectionFindings(flashing)).toEqual(["flashing or excessive contrast at 00:12"]);
    const low = computeKidqScore([assessment("MODEL", allFour(55), { criteria: SEEN })], config);
    expect(rejectionFindings(low)).toEqual(["score 55 is below 60"]);
  });

  it("leaves text-rule suspicions to the AI and the admin", () => {
    const suspected = computeKidqScore([assessment("RULE", {}, { criteria: [criterion("physical_violence", "FAIL")] })], config);
    expect(suspected.blockedBySafety).toBe(true);
    expect(rejectionFindings(suspected)).toEqual([]);
  });
});
