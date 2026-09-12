// Deterministic pre-checks (README "Token controls" #1): cheap text rules on the title,
// description and tags before any AI call, plus suggested tags for the admin to confirm.
// Rules only ever *flag*; they never clear content and never approve it.
import type { DiscoveryHints } from "../../connectors/types";
import { COMPONENTS, type ComponentInput, type CriterionInput } from "../scoring";

export interface SuggestedClassification {
  ageMin: number | null;
  ageMax: number | null;
  category: string | null;
  interests: string[];
  developmentGoals: string[];
  regulationGoals: string[];
  language: string | null;
  learningObjective: string | null;
  kidqSummary: string | null;
}

export interface RuleAnalysis {
  criteria: CriterionInput[];
  scores: ComponentInput[];
  classification: SuggestedClassification;
  summary: string;
  /** Set when the item should wait for an admin instead of spending AI quota. */
  skipAiReason: string | null;
}

export interface RuleInput {
  title: string;
  description: string | null;
  tags: string[];
  language: string | null;
  contentType?: string;
}

const word = (alternatives: string) => new RegExp(`\\b(?:${alternatives})\\b`, "i");

const TEXT_CHECKS: Array<{ key: string; pattern: RegExp; critical: boolean }> = [
  { key: "physical_violence", pattern: word("fight(?:ing|s)?|weapons?|guns?|kill(?:s|ing)?|blood(?:y)?|shoot(?:ing)?|stab(?:bing)?"), critical: true },
  { key: "frightening_imagery", pattern: word("horror|scary|creepy|terrifying|nightmare|zombies?"), critical: true },
  { key: "mature_themes", pattern: word("sexy|sex|drunk|beer|alcohol|drugs?|vap(?:e|ing)|cigarettes?"), critical: true },
  { key: "verbal_or_emotional_aggression", pattern: word("bully(?:ing)?|insults?|stupid|idiot|shut up"), critical: true },
  { key: "dangerous_behaviour", pattern: word("don'?t try this|dangerous stunts?|fireworks|knife"), critical: true },
  { key: "direct_advertising", pattern: word("sponsor(?:ed)?|buy now|use code|promo code|discount|giveaway|shop now"), critical: false },
  { key: "unboxing_or_toy_review", pattern: word("unboxing|toy review|surprise eggs?|haul"), critical: false },
  { key: "clickbait_title_or_thumbnail", pattern: word("shocking|you won'?t believe|gone wrong|prank|omg"), critical: false },
];

// The onboarding categories (architecture doc §9), first match wins. Picture books are always "storybooks".
const CATEGORY_RULES: Array<[string, RegExp]> = [
  ["storybooks", word("storybooks?|picture books?")],
  ["stories", word("story|stories|read[- ]?aloud|bedtime")],
  ["yoga_movement", word("yoga|stretch(?:ing)?|movement|exercise")],
  ["drawing_painting", word("draw(?:ing)?|paint(?:ing)?|colou?ring")],
  ["creative_crafts", word("crafts?|diy|clay|origami")],
  ["music_rhymes", word("songs?|rhymes?|sing[- ]?along|music|dance")],
  ["science", word("science|experiments?|space|planets?|moon|rocket|weather")],
  ["maths", word("count(?:ing)?|numbers?|maths?|shapes?|patterns?")],
  ["educational", word("alphabet|abc|phonics|letters?|first words|lessons?")],
  ["general_knowledge", word("animals?|fish|guppy|nature|plants?|ocean|birds?|insects?|facts?")],
  ["activities", word("activit(?:y|ies)|play[- ]?along|games?")],
  ["animated_videos", word("cartoons?|animated|animation")],
];

const INTEREST_RULES: Array<[string, RegExp]> = [
  ["animals", word("animals?|dogs?|cats?|lions?|elephants?|birds?|farm")],
  ["space", word("space|planets?|moon|stars?|rockets?|astronauts?")],
  ["numbers", word("count(?:ing)?|numbers?|maths?")],
  ["shapes_colors", word("shapes?|colou?rs?")],
  ["letters", word("alphabet|abc|phonics|letters?")],
  ["music", word("songs?|music|dance|sing")],
  ["stories", word("story|stories|read[- ]?aloud")],
  ["nature", word("nature|plants?|trees?|flowers?")],
  ["ocean", word("fish|ocean|sea|guppy")],
  ["weather", word("weather|rain|clouds?")],
  ["emotions", word("feelings?|emotions?")],
  ["yoga", word("yoga|breath(?:e|ing)|stretch")],
  ["art", word("draw(?:ing)?|paint(?:ing)?|crafts?")],
  ["kindness", word("kind(?:ness)?|shar(?:e|ing)|manners")],
  ["science_experiments", word("experiments?|science")],
];

const CATEGORY_GOALS: Record<string, { development: string[]; regulation: string[] }> = {
  stories: { development: ["communication"], regulation: [] },
  storybooks: { development: ["communication"], regulation: [] },
  yoga_movement: { development: ["motor_skills"], regulation: ["movement", "relaxation"] },
  drawing_painting: { development: ["creativity"], regulation: ["focus"] },
  creative_crafts: { development: ["creativity", "motor_skills"], regulation: ["focus"] },
  music_rhymes: { development: ["communication"], regulation: [] },
  science: { development: ["cognitive"], regulation: [] },
  maths: { development: ["cognitive"], regulation: [] },
  educational: { development: ["communication", "cognitive"], regulation: [] },
  general_knowledge: { development: ["learning"], regulation: [] },
  activities: { development: ["problem_solving"], regulation: ["focus"] },
};

// Age words mapped onto the five onboarding bands.
function suggestAge(text: string, hints: DiscoveryHints): { ageMin: number | null; ageMax: number | null } {
  if (hints.ageMin !== undefined && hints.ageMax !== undefined) return { ageMin: hints.ageMin, ageMax: hints.ageMax };
  if (word("baby|babies|infants?").test(text)) return { ageMin: 0, ageMax: 2 };
  if (word("toddlers?").test(text)) return { ageMin: 1, ageMax: 3 };
  if (word("preschool(?:ers)?|pre-?k").test(text)) return { ageMin: 3, ageMax: 5 };
  if (word("kindergarten").test(text)) return { ageMin: 5, ageMax: 6 };
  return { ageMin: null, ageMax: null };
}

function isShouty(title: string) {
  const letters = title.replace(/[^A-Za-z]/g, "");
  return (letters.length > 12 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6) || (title.match(/!/g)?.length ?? 0) >= 3;
}

export function analyzeWithRules(input: RuleInput, hints: DiscoveryHints = {}): RuleAnalysis {
  const text = [input.title, input.description ?? "", input.tags.join(" ")].join(" \n ");
  const criteria: CriterionInput[] = [];
  for (const check of TEXT_CHECKS) {
    const found = text.match(check.pattern)?.[0];
    if (found) criteria.push({ key: check.key, result: "FAIL", evidence: `Title, description or tags mention "${found}".`, timestamps: [] });
  }
  if (!criteria.some((c) => c.key === "clickbait_title_or_thumbnail") && isShouty(input.title)) {
    criteria.push({ key: "clickbait_title_or_thumbnail", result: "FAIL", evidence: "Title is mostly capitals or uses repeated exclamation marks.", timestamps: [] });
  }

  const category =
    hints.category ?? (input.contentType === "STORYBOOK" ? "storybooks" : (CATEGORY_RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? null));
  const interests = [...new Set([...(hints.interests ?? []), ...INTEREST_RULES.filter(([, pattern]) => pattern.test(text)).map(([key]) => key)])];
  const goals = category ? CATEGORY_GOALS[category] : undefined;
  const regulationFromText = word("calm(?:ing)?|sleep|bedtime|relax(?:ing)?|lullaby").test(text) ? ["calm", "relaxation"] : [];

  const criticalFlags = criteria.filter((c) => TEXT_CHECKS.find((check) => check.key === c.key)?.critical);
  return {
    criteria,
    scores: COMPONENTS.map((component) => ({
      component,
      value: null,
      status: "UNAVAILABLE" as const,
      selfConfidence: null,
      evidence: "Rule checks read only the title, description and tags.",
      timestamps: [],
    })),
    classification: {
      ...suggestAge(text, hints),
      category,
      interests,
      developmentGoals: [...new Set([...(hints.developmentGoals ?? []), ...(goals?.development ?? [])])],
      regulationGoals: [...new Set([...(hints.regulationGoals ?? []), ...(goals?.regulation ?? []), ...regulationFromText])],
      language: input.language,
      learningObjective: null,
      kidqSummary: null,
    },
    summary: criteria.length
      ? `Rule pre-checks flagged ${criteria.length} item(s) in the title, description or tags.`
      : "Rule pre-checks found no issues in the title, description or tags.",
    skipAiReason: criticalFlags.length ? "RULE_CRITICAL_FLAG" : null,
  };
}
