// KidQ curation rubric — every criterion from docs/content-curation/README.md ("Curation rubric"),
// plus `dangerous_behaviour` from the scoring MD's hard safety list (rubric v2).
// Filter-out criteria FAIL when the problem is present; filter-in criteria PASS when the quality is present.

export type CriterionGroup = "FILTER_OUT" | "FILTER_IN";
export type CriterionResult = "PASS" | "FAIL" | "UNKNOWN";

export interface CriterionDefinition {
  key: string;
  group: CriterionGroup;
  /** A FAIL blocks the score and publication until an admin resolves it (hard safety check). */
  critical: boolean;
  /** Cannot be judged from metadata or transcript alone (README "Evidence boundary"). */
  requiresAudiovisual: boolean;
  description: string;
}

export const RUBRIC_VERSION = "2";

function define(
  group: CriterionGroup,
  key: string,
  description: string,
  flags: { critical?: boolean; audiovisual?: boolean } = {},
): CriterionDefinition {
  return { key, group, description, critical: flags.critical ?? false, requiresAudiovisual: flags.audiovisual ?? false };
}

const out = (key: string, description: string, flags?: { critical?: boolean; audiovisual?: boolean }) =>
  define("FILTER_OUT", key, description, flags);
const inn = (key: string, description: string, flags?: { audiovisual?: boolean }) => define("FILTER_IN", key, description, flags);

export const RUBRIC: readonly CriterionDefinition[] = [
  out("rapid_visual_cuts", "Cuts or scene changes are too fast for a young child to process", { audiovisual: true }),
  out("flashing_or_excessive_contrast", "Flashing lights or intense contrasting colours may overstimulate", { audiovisual: true }),
  out("loud_or_jarring_audio", "Sudden loud effects, aggressive music, or constant chaotic noise", { audiovisual: true }),
  out("cluttered_visuals", "Too many competing objects or movements obscure the learning focus", { audiovisual: true }),
  out("physical_violence", "Hitting, fighting, weapons, injury, or physical aggression", { critical: true }),
  out("verbal_or_emotional_aggression", "Threatening, bullying, humiliation, yelling, or severe abusive language", { critical: true }),
  out("frightening_imagery", "Monsters, darkness, threat, peril, or imagery likely to induce fear", { critical: true, audiovisual: true }),
  out("mature_themes", "Sexual or explicit content, adult relationships, substance use, or other unsuitable themes", { critical: true }),
  out("discrimination_or_stereotypes", "Prejudice or harmful stereotypes about gender, race, religion, culture, disability, or identity", { critical: true }),
  out("dangerous_behaviour", "Shows or encourages behaviour a child could copy and get hurt", { critical: true }),
  out("direct_advertising", "Commercials, explicit promotions, calls to purchase, or sponsor segments"),
  out("product_placement", "Products or brands promoted as part of the content"),
  out("unboxing_or_toy_review", "Primary purpose is unboxing or reviewing consumer products"),
  out("franchise_led_promotion", "Educational value is secondary to promoting a toy or commercial franchise"),
  out("endless_or_open_loop", "Designed to continue indefinitely without a natural conclusion"),
  out("clickbait_title_or_thumbnail", "Sensational wording or imagery exaggerates the actual content"),
  out("repetitive_without_objective", "Repetition lacks a clear educational, creative, social, or motor objective"),
  out("passive_viewing_only", "No invitation to think, speak, move, predict, create, or interact"),
  out("developmental_mismatch", "Language, theme, motor demand, or complexity is well outside the assigned age band"),
  inn("clear_learning_objective", "Teaches a specific concept or skill"),
  inn("vocabulary_in_context", "New words are introduced clearly with meaningful context"),
  inn("problem_solving_narrative", "A simple challenge is recognised and constructively resolved"),
  inn("fine_motor_prompt", "Encourages tracing, matching, drawing, manipulating, or similar fine-motor action"),
  inn("gross_motor_prompt", "Encourages movement, balance, stretching, jumping, or imitation"),
  inn("slow_deliberate_pacing", "Visual changes leave adequate processing time", { audiovisual: true }),
  inn("gentle_soothing_audio", "Narration, music, and effects stay calm without disruptive peaks", { audiovisual: true }),
  inn("simple_uncluttered_visuals", "The main object or character is clear and backgrounds are minimally distracting", { audiovisual: true }),
  inn("predictable_structure", "Comprehensible beginning, middle, and end or a repeated learning pattern"),
  inn("empathy_and_kindness", "Helping, sharing, caring, or perspective-taking is modelled"),
  inn("emotional_literacy", "Emotions are named or expressed constructively"),
  inn("diversity_and_inclusion", "People, cultures, families, or abilities are represented respectfully"),
  inn("constructive_conflict_resolution", "Disagreement is resolved gently and safely"),
  inn("participation_prompts", "Children are asked to answer, sing, imitate, point, count, or move"),
  inn("meaningful_touch_interaction", "Touch interaction is simple, age-appropriate, and serves learning"),
  inn("open_ended_questions", "Questions invite thought or parent-child discussion"),
  inn("craft_or_diy_extension", "A safe, practical creative activity can follow"),
  inn("nature_exploration_extension", "Encourages observation of the natural world"),
  inn("imaginative_play_extension", "Can lead to role-play or open-ended imagination"),
  inn("age_band_fit", "Theme, language, pace, and expected actions fit one or more KidQ age bands"),
];

const byKey = new Map(RUBRIC.map((criterion) => [criterion.key, criterion]));

export const CRITICAL_KEYS = RUBRIC.filter((criterion) => criterion.critical).map((criterion) => criterion.key);

export function getCriterion(key: string): CriterionDefinition | undefined {
  return byKey.get(key);
}

export function isKnownCriterion(key: string): boolean {
  return byKey.has(key);
}
