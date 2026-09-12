// KidQ content score (scoring MD §5–§6, §25): hard safety check first, then the weighted
// score over whichever components were measured, with a confidence figure and a reason.
// Pure: no I/O. The API is the only place this runs; UIs display the result.

import { CRITICAL_KEYS, type CriterionResult } from "../rubric";

export const COMPONENTS = ["CONTENT_LANGUAGE", "PACING", "VISUAL_COMFORT", "AUDIO_COMFORT"] as const;
export type Component = (typeof COMPONENTS)[number];
export type AssessorType = "RULE" | "MODEL" | "HUMAN";

export const COMPONENT_LABELS: Record<Component, string> = {
  CONTENT_LANGUAGE: "Content & language",
  PACING: "Pacing",
  VISUAL_COMFORT: "Visual comfort",
  AUDIO_COMFORT: "Audio comfort",
};

// A picture book has no soundtrack: it is scored on three components, two of them relabelled.
const STORY_COMPONENTS: readonly Component[] = ["CONTENT_LANGUAGE", "PACING", "VISUAL_COMFORT"];
const STORY_LABELS: Partial<Record<Component, string>> = { PACING: "Reading pace", VISUAL_COMFORT: "Illustrations" };

export function componentsFor(contentType: string): readonly Component[] {
  return contentType === "STORYBOOK" ? STORY_COMPONENTS : COMPONENTS;
}

export function componentLabel(component: Component, contentType: string): string {
  return (contentType === "STORYBOOK" && STORY_LABELS[component]) || COMPONENT_LABELS[component];
}

export interface ScoringConfig {
  version: string;
  weights: Record<Component, number>;
  sourceReliability: Record<AssessorType, number>;
  minAiConfidence: number;
}

export interface ComponentInput {
  component: Component;
  value: number | null;
  status: "MEASURED" | "UNAVAILABLE";
  selfConfidence: number | null;
  evidence: string;
  timestamps: string[];
}

export interface CriterionInput {
  key: string;
  result: CriterionResult;
  evidence: string;
  timestamps: string[];
}

export interface AssessmentInput {
  id: string;
  assessorType: AssessorType;
  createdAt: Date;
  scores: ComponentInput[];
  criteria: CriterionInput[];
}

export interface ComponentResult {
  component: Component;
  label: string;
  weight: number;
  value: number | null;
  source: AssessorType | null;
  assessmentId: string | null;
  evidence: string | null;
  timestamps: string[];
  selfConfidence: number | null;
}

export interface SafetyFlag {
  key: string;
  evidence: string;
  timestamps: string[];
  source: AssessorType;
}

export interface KidqScoreResult {
  version: string;
  /** Null when nothing was measured, or when withheld by a critical safety flag. */
  score: number | null;
  confidence: number;
  components: ComponentResult[];
  missing: string[];
  blockedBySafety: boolean;
  safetyFlags: SafetyFlag[];
  lowConfidence: Component[];
  reason: string;
}

// HUMAN beats MODEL beats RULE; within one assessor type the newest wins.
const PRECEDENCE: AssessorType[] = ["HUMAN", "MODEL", "RULE"];

function newestFirst(assessments: AssessmentInput[]) {
  return [...assessments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  // toFixed first absorbs float noise (88.74999… → 88.75) before half-up rounding.
  return Math.round(Number(value.toFixed(6)) * factor) / factor;
}

function resolveCriteria(assessments: AssessmentInput[]) {
  const resolved = new Map<string, CriterionInput & { source: AssessorType }>();
  for (const source of PRECEDENCE) {
    for (const assessment of assessments.filter((a) => a.assessorType === source)) {
      for (const criterion of assessment.criteria) {
        if (!resolved.has(criterion.key)) resolved.set(criterion.key, { ...criterion, source });
      }
    }
  }
  return resolved;
}

function resolveComponent(assessments: AssessmentInput[], component: Component, weight: number, label: string): ComponentResult {
  for (const source of PRECEDENCE) {
    for (const assessment of assessments.filter((a) => a.assessorType === source)) {
      const score = assessment.scores.find((s) => s.component === component && s.status === "MEASURED" && s.value !== null);
      if (score) {
        return {
          component,
          label,
          weight,
          value: score.value,
          source,
          assessmentId: assessment.id,
          evidence: score.evidence,
          timestamps: score.timestamps,
          selfConfidence: score.selfConfidence,
        };
      }
    }
  }
  return {
    component,
    label,
    weight,
    value: null,
    source: null,
    assessmentId: null,
    evidence: null,
    timestamps: [],
    selfConfidence: null,
  };
}

function joinLabels(labels: string[]) {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function buildReason(result: Omit<KidqScoreResult, "reason">) {
  if (result.blockedBySafety) {
    const flag = result.safetyFlags[0];
    return `Score withheld: safety flag "${flag.key.replace(/_/g, " ")}" — ${flag.evidence}`;
  }
  const measured = result.components.filter((c) => c.value !== null);
  if (measured.length === 0) return "Not scored yet: no analysis is available.";
  const strong = measured.filter((c) => (c.value ?? 0) >= 80).map((c) => c.label.toLowerCase());
  const weak = measured.filter((c) => (c.value ?? 0) < 60).map((c) => `${c.label.toLowerCase()} (${Math.round(c.value ?? 0)})`);
  const sentences: string[] = [];
  if (strong.length) sentences.push(`Strong ${joinLabels(strong)}.`);
  if (weak.length) sentences.push(`Needs a closer look: ${joinLabels(weak)}.`);
  if (!strong.length && !weak.length) sentences.push("Moderate across the measured parameters.");
  if (result.missing.length) sentences.push(`${result.missing.join("; ")}.`);
  return sentences.join(" ");
}

export function computeKidqScore(assessments: AssessmentInput[], config: ScoringConfig, contentType = "VIDEO"): KidqScoreResult {
  const ordered = newestFirst(assessments);

  // 1. Hard safety check before any weighting (scoring MD §5).
  const criteria = resolveCriteria(ordered);
  const safetyFlags: SafetyFlag[] = CRITICAL_KEYS.flatMap((key) => {
    const criterion = criteria.get(key);
    return criterion?.result === "FAIL"
      ? [{ key, evidence: criterion.evidence, timestamps: criterion.timestamps, source: criterion.source }]
      : [];
  });
  const blockedBySafety = safetyFlags.length > 0;

  // 2. Weighted score over measured components, renormalised by the measured weight.
  const components = componentsFor(contentType).map((component) =>
    resolveComponent(ordered, component, config.weights[component], componentLabel(component, contentType)),
  );
  const measured = components.filter((c) => c.value !== null);
  const measuredWeight = measured.reduce((sum, c) => sum + c.weight, 0);
  const weighted = measured.reduce((sum, c) => sum + c.weight * (c.value ?? 0), 0);
  const rawScore = measuredWeight > 0 ? weighted / measuredWeight : null;

  // 3. Confidence: share of the applicable weight that was measured, discounted by who measured it.
  const applicableWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const confidence = round(
    measured.reduce((sum, c) => sum + c.weight * config.sourceReliability[c.source ?? "RULE"], 0) / (applicableWeight || 1),
    3,
  );

  const partial = {
    version: config.version,
    score: blockedBySafety || rawScore === null ? null : round(rawScore, 1),
    confidence: Math.min(1, confidence),
    components,
    missing: components.filter((c) => c.value === null).map((c) => `${c.label} analysis unavailable`),
    blockedBySafety,
    safetyFlags,
    lowConfidence: components
      .filter((c) => c.source === "MODEL" && c.selfConfidence !== null && c.selfConfidence < config.minAiConfidence)
      .map((c) => c.component),
  };
  return { ...partial, reason: buildReason(partial) };
}

/** Current result per criterion across all assessments (HUMAN > MODEL > RULE, newest first). */
export function resolvedCriteria(assessments: AssessmentInput[]) {
  return resolveCriteria(newestFirst(assessments));
}

export interface ClassificationState {
  ageMin: number | null;
  ageMax: number | null;
  category: string | null;
  developmentGoals: string[];
  regulationGoals: string[];
}

export type PublishBlocker =
  | "CRITICAL_FLAG"
  | "MISSING_COMPONENTS"
  | "LOW_AI_CONFIDENCE"
  | "MISSING_AGE"
  | "MISSING_CATEGORY"
  | "MISSING_GOAL"
  | "NOT_PLAYABLE";

/** Everything that stops an item from being "Ready to approve". Empty array = ready. */
export function publishBlockers(
  score: KidqScoreResult,
  classification: ClassificationState,
  playback: { available: boolean; embeddable: boolean | null },
): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];
  if (score.blockedBySafety) blockers.push("CRITICAL_FLAG");
  if (score.missing.length > 0) blockers.push("MISSING_COMPONENTS");
  if (score.lowConfidence.length > 0) blockers.push("LOW_AI_CONFIDENCE");
  if (classification.ageMin === null || classification.ageMax === null) blockers.push("MISSING_AGE");
  if (!classification.category) blockers.push("MISSING_CATEGORY");
  if (classification.developmentGoals.length === 0 && classification.regulationGoals.length === 0) blockers.push("MISSING_GOAL");
  if (!playback.available || playback.embeddable === false) blockers.push("NOT_PLAYABLE");
  return blockers;
}
