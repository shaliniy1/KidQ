// KidQ curation rubric — every criterion from docs/content-curation/README.md ("Curation rubric"),
// plus `dangerous_behaviour` from the scoring MD's hard safety list.
// Filter-out criteria FAIL when the problem is present; filter-in criteria PASS when the quality is present.
// Rubric v3 gives each filter-out criterion a tier and each filter-in criterion a learning area.

export type CriterionGroup = "FILTER_OUT" | "FILTER_IN";
export type CriterionResult = "PASS" | "FAIL" | "UNKNOWN";
/** What a FAIL does: SAFETY withholds the score, EXCLUDE rejects the item, FLAG only shows the problem. */
export type CriterionTier = "SAFETY" | "EXCLUDE" | "FLAG";
/** The learning area a filter-in PASS counts toward (learning value). */
export type LearningArea = "THINKING" | "LANGUAGE" | "FEELINGS" | "DOING";

export interface CriterionDefinition {
  key: string;
  group: CriterionGroup;
  /** A FAIL blocks the score and publication until an admin resolves it (hard safety check). */
  critical: boolean;
  /** Filter-out criteria only. */
  tier: CriterionTier | null;
  /** Filter-in criteria only; null for the comfort criteria, which the score itself covers. */
  area: LearningArea | null;
  /** Cannot be judged from metadata or transcript alone (README "Evidence boundary"). */
  requiresAudiovisual: boolean;
  description: string;
}

export const RUBRIC_VERSION = "3";

export const LEARNING_AREA_LABELS: Record<LearningArea, string> = {
  THINKING: "Thinking",
  LANGUAGE: "Language",
  FEELINGS: "Feelings & friends",
  DOING: "Doing",
};

const out = (key: string, description: string, tier: CriterionTier, flags: { audiovisual?: boolean } = {}): CriterionDefinition => ({
  key,
  group: "FILTER_OUT",
  description,
  tier,
  area: null,
  critical: tier === "SAFETY",
  requiresAudiovisual: flags.audiovisual ?? false,
});
const inn = (key: string, description: string, area: LearningArea | null, flags: { audiovisual?: boolean } = {}): CriterionDefinition => ({
  key,
  group: "FILTER_IN",
  description,
  tier: null,
  area,
  critical: false,
  requiresAudiovisual: flags.audiovisual ?? false,
});

export const RUBRIC: readonly CriterionDefinition[] = [
  out("rapid_visual_cuts", "Cuts or scene changes are too fast for a young child to process", "EXCLUDE", { audiovisual: true }),
  out("flashing_or_excessive_contrast", "Flashing lights, or harsh, neon or intensely contrasting colours, may overstimulate", "EXCLUDE", { audiovisual: true }),
  out("loud_or_jarring_audio", "Sudden loud effects, aggressive music, or constant chaotic noise", "EXCLUDE", { audiovisual: true }),
  out("cluttered_visuals", "Too many competing objects or movements obscure the learning focus", "FLAG", { audiovisual: true }),
  out("physical_violence", "Hitting, fighting, weapons, injury, or physical aggression", "SAFETY"),
  out("verbal_or_emotional_aggression", "Threatening, bullying, humiliation, yelling, or severe abusive language", "SAFETY"),
  out("frightening_imagery", "Monsters, darkness, threat, peril, or imagery likely to induce fear", "SAFETY", { audiovisual: true }),
  out("mature_themes", "Sexual or explicit content, adult relationships, substance use, or other unsuitable themes", "SAFETY"),
  out("discrimination_or_stereotypes", "Prejudice or harmful stereotypes about gender, race, religion, culture, disability, or identity", "SAFETY"),
  out("dangerous_behaviour", "Shows or encourages behaviour a child could copy and get hurt", "SAFETY"),
  out("direct_advertising", "Commercials, explicit promotions, calls to purchase, or sponsor segments", "EXCLUDE"),
  out("product_placement", "Products or brands promoted as part of the content", "FLAG"),
  out("unboxing_or_toy_review", "Primary purpose is unboxing or reviewing consumer products", "EXCLUDE"),
  out("franchise_led_promotion", "Educational value is secondary to promoting a toy or commercial franchise", "EXCLUDE"),
  out("endless_or_open_loop", "Designed to continue indefinitely without a natural conclusion", "EXCLUDE"),
  out("clickbait_title_or_thumbnail", "Sensational wording or imagery exaggerates the actual content", "FLAG"),
  out("repetitive_without_objective", "Repetition lacks a clear educational, creative, social, or motor objective", "FLAG"),
  out("passive_viewing_only", "No invitation to think, speak, move, predict, create, or interact", "FLAG"),
  out(
    "developmental_mismatch",
    "Made for adults or older children, or its language, theme, motor demand or complexity is well outside the assigned age band",
    "EXCLUDE",
  ),
  inn("clear_learning_objective", "Teaches a specific concept or skill", "THINKING"),
  inn("vocabulary_in_context", "New words are introduced clearly with meaningful context", "LANGUAGE"),
  inn("problem_solving_narrative", "A simple challenge is recognised and constructively resolved", "THINKING"),
  inn("fine_motor_prompt", "Encourages tracing, matching, drawing, manipulating, or similar fine-motor action", "DOING"),
  inn("gross_motor_prompt", "Encourages movement, balance, stretching, jumping, or imitation", "DOING"),
  inn("slow_deliberate_pacing", "Visual changes leave adequate processing time", null, { audiovisual: true }),
  inn("gentle_soothing_audio", "Narration, music, and effects stay calm without disruptive peaks", null, { audiovisual: true }),
  inn("simple_uncluttered_visuals", "The main object or character is clear and backgrounds are minimally distracting", null, { audiovisual: true }),
  inn("predictable_structure", "Comprehensible beginning, middle, and end or a repeated learning pattern", "LANGUAGE"),
  inn("empathy_and_kindness", "Helping, sharing, caring, or perspective-taking is modelled", "FEELINGS"),
  inn("emotional_literacy", "Emotions are named or expressed constructively", "FEELINGS"),
  inn("diversity_and_inclusion", "People, cultures, families, or abilities are represented respectfully", "FEELINGS"),
  inn("constructive_conflict_resolution", "Disagreement is resolved gently and safely", "FEELINGS"),
  inn("participation_prompts", "Children are asked to answer, sing, imitate, point, count, or move", "DOING"),
  inn("meaningful_touch_interaction", "Touch interaction is simple, age-appropriate, and serves learning", "DOING"),
  inn("open_ended_questions", "Questions invite thought or parent-child discussion", "THINKING"),
  inn("craft_or_diy_extension", "A safe, practical creative activity can follow", "DOING"),
  inn("nature_exploration_extension", "Encourages observation of the natural world", "DOING"),
  inn("imaginative_play_extension", "Can lead to role-play or open-ended imagination", "DOING"),
  inn("age_band_fit", "Theme, language, pace, and expected actions fit one or more KidQ age bands", null),
];

const byKey = new Map(RUBRIC.map((criterion) => [criterion.key, criterion]));

export const CRITICAL_KEYS = RUBRIC.filter((criterion) => criterion.tier === "SAFETY").map((criterion) => criterion.key);
export const EXCLUDE_KEYS = RUBRIC.filter((criterion) => criterion.tier === "EXCLUDE").map((criterion) => criterion.key);

export function getCriterion(key: string): CriterionDefinition | undefined {
  return byKey.get(key);
}

export function isKnownCriterion(key: string): boolean {
  return byKey.has(key);
}

/** "rapid_visual_cuts" → "rapid visual cuts", for plain-language reasons. */
export function criterionName(key: string): string {
  return key.replace(/_/g, " ");
}
