// KidQ content score (scoring MD §5–§6, §25): hard safety check first, then the weighted
// score over whichever components were measured, with a confidence figure and a reason.
// KIDQ_SCORE_V2 (docs/recommendation/README.md) adds evidence caps, a confidence that reflects
// how sure the AI was, and a separate learning value from the filter-in criteria.
// Pure: no I/O. The API is the only place this runs; UIs display the result.

import { CRITICAL_KEYS, EXCLUDE_KEYS, RUBRIC, criterionName, type CriterionResult, type LearningArea } from "../rubric";

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
  /** The lowest confidence an item can have and still be "Ready to approve". */
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
  /** The failed check that lowered this value. Admin-set values are never capped. */
  cap: { criterion: string; max: number } | null;
}

export interface SafetyFlag {
  key: string;
  evidence: string;
  timestamps: string[];
  source: AssessorType;
}

export interface LearningValue {
  /** 0–100: 25 for each learning area with a filter-in PASS; null until the AI or an admin has judged any. */
  value: number | null;
  areas: LearningArea[];
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
  /** Failed KidQ exclusions: fast cuts, flashing or harsh colours, loud sound, ads, made for adults. */
  exclusions: SafetyFlag[];
  lowConfidence: Component[];
  /** The whole score is less sure than the scoring config's minimum. */
  belowConfidence: boolean;
  learning: LearningValue;
  reason: string;
}

/** Publish policy: 70+ can be ready to approve, 60–69 needs a look, and KidQ rejects anything under 60. */
export const PUBLISH_MIN_SCORE = 70;
export const REJECT_BELOW_SCORE = 60;

/** A failed check caps the part of the score it's about. */
export const CRITERION_CAPS: ReadonlyArray<{ key: string; component: Component; max: number }> = [
  { key: "rapid_visual_cuts", component: "PACING", max: 50 },
  { key: "flashing_or_excessive_contrast", component: "VISUAL_COMFORT", max: 40 },
  { key: "cluttered_visuals", component: "VISUAL_COMFORT", max: 65 },
  { key: "loud_or_jarring_audio", component: "AUDIO_COMFORT", max: 50 },
  { key: "direct_advertising", component: "CONTENT_LANGUAGE", max: 60 },
  { key: "product_placement", component: "CONTENT_LANGUAGE", max: 60 },
  { key: "unboxing_or_toy_review", component: "CONTENT_LANGUAGE", max: 60 },
  { key: "franchise_led_promotion", component: "CONTENT_LANGUAGE", max: 60 },
];

// Criteria the AI can judge only by watching and listening. A picture book has no sound or motion.
const AUDIOVISUAL_KEYS = RUBRIC.filter((criterion) => criterion.requiresAudiovisual).map((criterion) => criterion.key);
const BOOK_AUDIOVISUAL_KEYS = ["flashing_or_excessive_contrast", "cluttered_visuals", "frightening_imagery", "simple_uncluttered_visuals"];
const DEFAULT_AI_CERTAINTY = 0.7;
const LEARNING_AREAS: LearningArea[] = ["THINKING", "LANGUAGE", "FEELINGS", "DOING"];

// HUMAN beats MODEL beats RULE; within one assessor type the newest wins.
const PRECEDENCE: AssessorType[] = ["HUMAN", "MODEL", "RULE"];

type ResolvedCriterion = CriterionInput & { source: AssessorType };

function newestFirst(assessments: AssessmentInput[]) {
  return [...assessments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  // toFixed first absorbs float noise (88.74999… → 88.75) before half-up rounding.
  return Math.round(Number(value.toFixed(6)) * factor) / factor;
}

// A definite PASS or FAIL beats an UNKNOWN from a higher-precedence assessor: "couldn't judge" never hides evidence.
function resolveCriteria(assessments: AssessmentInput[]) {
  const resolved = new Map<string, ResolvedCriterion>();
  for (const source of PRECEDENCE) {
    for (const assessment of assessments.filter((a) => a.assessorType === source)) {
      for (const criterion of assessment.criteria) {
        const current = resolved.get(criterion.key);
        if (!current || (current.result === "UNKNOWN" && criterion.result !== "UNKNOWN")) resolved.set(criterion.key, { ...criterion, source });
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
          cap: null,
        };
      }
    }
  }
  return { component, label, weight, value: null, source: null, assessmentId: null, evidence: null, timestamps: [], selfConfidence: null, cap: null };
}

/** The tightest cap from this component's failed checks, if it lowers the value. */
function capFor(component: ComponentResult, criteria: Map<string, ResolvedCriterion>): ComponentResult["cap"] {
  if (component.value === null || component.source === "HUMAN") return null;
  let cap: ComponentResult["cap"] = null;
  for (const rule of CRITERION_CAPS) {
    if (rule.component === component.component && criteria.get(rule.key)?.result === "FAIL" && (!cap || rule.max < cap.max)) {
      cap = { criterion: rule.key, max: rule.max };
    }
  }
  return cap && component.value > cap.max ? cap : null;
}

/** Share of the sight-and-sound checks nobody could answer. */
function unknownShare(criteria: Map<string, ResolvedCriterion>, contentType: string): number {
  const keys = contentType === "STORYBOOK" ? BOOK_AUDIOVISUAL_KEYS : AUDIOVISUAL_KEYS;
  return keys.filter((key) => (criteria.get(key)?.result ?? "UNKNOWN") === "UNKNOWN").length / keys.length;
}

function learningValue(criteria: Map<string, ResolvedCriterion>): LearningValue {
  let judged = false;
  const areas = new Set<LearningArea>();
  for (const definition of RUBRIC) {
    const criterion = definition.area ? criteria.get(definition.key) : undefined;
    if (!definition.area || !criterion || criterion.source === "RULE" || criterion.result === "UNKNOWN") continue;
    judged = true;
    if (criterion.result === "PASS") areas.add(definition.area);
  }
  return judged ? { value: areas.size * 25, areas: LEARNING_AREAS.filter((area) => areas.has(area)) } : { value: null, areas: [] };
}

function joinLabels(labels: string[]) {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function buildReason(result: Omit<KidqScoreResult, "reason">) {
  if (result.blockedBySafety) {
    const flag = result.safetyFlags[0];
    return `Score withheld: safety flag "${criterionName(flag.key)}" — ${flag.evidence}`;
  }
  const measured = result.components.filter((c) => c.value !== null);
  if (measured.length === 0) return "Not scored yet: no analysis is available.";
  const strong = measured.filter((c) => (c.value ?? 0) >= 80).map((c) => c.label.toLowerCase());
  const weak = measured.filter((c) => (c.value ?? 0) < 60).map((c) => `${c.label.toLowerCase()} (${Math.round(c.value ?? 0)})`);
  const capped = measured.flatMap((c) => (c.cap ? [`${c.label.toLowerCase()} at ${c.cap.max} (${criterionName(c.cap.criterion)})`] : []));
  const sentences: string[] = [];
  if (strong.length) sentences.push(`Strong ${joinLabels(strong)}.`);
  if (weak.length) sentences.push(`Needs a closer look: ${joinLabels(weak)}.`);
  if (!strong.length && !weak.length) sentences.push("Moderate across the measured parameters.");
  if (capped.length) sentences.push(`Capped: ${joinLabels(capped)}.`);
  if (result.exclusions.length) sentences.push(`Fails KidQ checks: ${joinLabels(result.exclusions.map((flag) => criterionName(flag.key)))}.`);
  if (result.missing.length) sentences.push(`${result.missing.join("; ")}.`);
  return sentences.join(" ");
}

export function computeKidqScore(assessments: AssessmentInput[], config: ScoringConfig, contentType = "VIDEO"): KidqScoreResult {
  const ordered = newestFirst(assessments);

  // 1. Hard safety check before any weighting (scoring MD §5), and KidQ's exclusions.
  const criteria = resolveCriteria(ordered);
  const failed = (keys: readonly string[]): SafetyFlag[] =>
    keys.flatMap((key) => {
      const criterion = criteria.get(key);
      return criterion?.result === "FAIL" ? [{ key, evidence: criterion.evidence, timestamps: criterion.timestamps, source: criterion.source }] : [];
    });
  const safetyFlags = failed(CRITICAL_KEYS);
  const exclusions = failed(EXCLUDE_KEYS);
  const blockedBySafety = safetyFlags.length > 0;

  // 2. Each component capped by its failed checks; the weighted score renormalised by the measured weight.
  const raw = componentsFor(contentType).map((component) =>
    resolveComponent(ordered, component, config.weights[component], componentLabel(component, contentType)),
  );
  const components = raw.map((component) => {
    const cap = capFor(component, criteria);
    return cap ? { ...component, value: cap.max, cap } : component;
  });
  const measured = components.filter((c) => c.value !== null);
  const measuredWeight = measured.reduce((sum, c) => sum + c.weight, 0);
  const weighted = measured.reduce((sum, c) => sum + c.weight * (c.value ?? 0), 0);
  const rawScore = measuredWeight > 0 ? weighted / measuredWeight : null;

  // 3. Confidence: the share of the applicable weight that was measured, discounted by who measured it and,
  //    for the AI, by how sure it was — less when it left sight or sound checks unanswered or needed a big cap.
  const share = unknownShare(criteria, contentType);
  const applicableWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const confidence = round(
    components.reduce((sum, component, index) => {
      if (component.value === null) return sum;
      const reliability = config.sourceReliability[component.source ?? "RULE"];
      if (component.source !== "MODEL") return sum + component.weight * reliability;
      const drop = (raw[index].value ?? 0) - component.value;
      const certainty = (component.selfConfidence ?? DEFAULT_AI_CERTAINTY) * (1 - 0.3 * share) * (drop > 15 ? 0.85 : 1);
      return sum + component.weight * reliability * certainty;
    }, 0) / (applicableWeight || 1),
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
    exclusions,
    lowConfidence: components
      .filter((c) => c.source === "MODEL" && c.selfConfidence !== null && c.selfConfidence < config.minAiConfidence)
      .map((c) => c.component),
    belowConfidence: measured.length > 0 && confidence < config.minAiConfidence,
    learning: learningValue(criteria),
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
  | "EXCLUDED"
  | "LOW_SCORE"
  | "BORDERLINE_SCORE"
  | "MISSING_COMPONENTS"
  | "LOW_AI_CONFIDENCE"
  | "MISSING_AGE"
  | "MISSING_CATEGORY"
  | "MISSING_GOAL"
  | "NOT_PLAYABLE";

/** Blockers an admin may publish over with a written reason; the others need fixing first. */
export const JUDGEMENT_BLOCKERS: readonly PublishBlocker[] = ["CRITICAL_FLAG", "EXCLUDED", "LOW_SCORE", "BORDERLINE_SCORE", "LOW_AI_CONFIDENCE"];

/** Everything that stops an item from being "Ready to approve". Empty array = ready. */
export function publishBlockers(
  score: KidqScoreResult,
  classification: ClassificationState,
  playback: { available: boolean; embeddable: boolean | null },
): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];
  if (score.blockedBySafety) blockers.push("CRITICAL_FLAG");
  if (score.exclusions.length > 0) blockers.push("EXCLUDED");
  if (score.score !== null && score.score < REJECT_BELOW_SCORE) blockers.push("LOW_SCORE");
  else if (score.score !== null && score.score < PUBLISH_MIN_SCORE) blockers.push("BORDERLINE_SCORE");
  if (score.missing.length > 0) blockers.push("MISSING_COMPONENTS");
  if (score.belowConfidence) blockers.push("LOW_AI_CONFIDENCE");
  if (classification.ageMin === null || classification.ageMax === null) blockers.push("MISSING_AGE");
  if (!classification.category) blockers.push("MISSING_CATEGORY");
  if (classification.developmentGoals.length === 0 && classification.regulationGoals.length === 0) blockers.push("MISSING_GOAL");
  if (!playback.available || playback.embeddable === false) blockers.push("NOT_PLAYABLE");
  return blockers;
}

/**
 * Confirmed problems that make KidQ reject an item itself (docs "Publish policy"): a safety flag or
 * exclusion the AI or an admin confirmed, or a score under 60. Text-rule suspicions don't count.
 */
export function rejectionFindings(score: KidqScoreResult): string[] {
  const describe = (flag: SafetyFlag) => `${criterionName(flag.key)}${flag.timestamps[0] ? ` at ${flag.timestamps[0]}` : ""}`;
  return [
    ...score.safetyFlags.filter((flag) => flag.source !== "RULE").map((flag) => `safety: ${describe(flag)}`),
    ...score.exclusions.filter((flag) => flag.source !== "RULE").map(describe),
    ...(score.score !== null && score.score < REJECT_BELOW_SCORE ? [`score ${score.score} is below ${REJECT_BELOW_SCORE}`] : []),
  ];
}
