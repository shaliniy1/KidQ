// Deterministic pre-checks (README "Token controls" #1): cheap text rules on the title,
// description and tags, plus suggested tags for the AI and the admin to confirm.
// Rules only ever *flag*; they never clear content and never approve it. A flagged item still
// goes to the AI, which watches it and confirms or clears the flag (MODEL beats RULE).
import type { DiscoveryHints } from "../../connectors/types";
import { COMPONENTS, type ComponentInput, type CriterionInput } from "../scoring";

export interface SuggestedClassification {
  ageMin: number | null;
  ageMax: number | null;
  /** The primary category: the first of `categories`. */
  category: string | null;
  /** Every category the item fits, primary first, at most MAX_CATEGORIES. */
  categories: string[];
  interests: string[];
  developmentGoals: string[];
  regulationGoals: string[];
  /** Session modes (MORNING, DAYTIME, BEDTIME); only the AI suggests them, the rules leave them alone. */
  sessionModes?: string[];
  language: string | null;
  learningObjective: string | null;
  kidqSummary: string | null;
}

export interface RuleAnalysis {
  criteria: CriterionInput[];
  scores: ComponentInput[];
  classification: SuggestedClassification;
  summary: string;
  /** A text rule suspects a safety problem; the AI confirms or clears it. */
  flaggedCritical: boolean;
}

export interface RuleInput {
  title: string;
  description: string | null;
  tags: string[];
  language: string | null;
  contentType?: string;
  /** Source system id, for its usual category (NASA → Science). */
  source?: string;
}

export const MAX_CATEGORIES = 3;

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

// The onboarding categories (architecture doc §9) in priority order. Storybooks is a format: picture
// books always get it first and videos never do. "Drawing" counts as art only in art phrases, so
// "Drawing blood" in a NASA description is not Painting.
const CATEGORY_RULES: Array<[string, RegExp]> = [
  ["stories", word("stor(?:y|ies)|storytime|read[- ]?alouds?|bedtime|fairy ?tales?|once upon a time")],
  ["yoga_movement", word("yoga|stretch(?:es|ing)?|breathing exercises?|mindful movement")],
  ["drawing_painting", word("how to draw|draw(?:ing)? (?:a|an|the|for|with|lessons?|tutorials?)|paint(?:s|ing|ings)?|colou?ring|crayons?|doodl(?:e|es|ing)")],
  ["creative_crafts", word("crafts?|diy|clay|origami|playdough|play-doh|paper (?:plates?|cups?|crafts?)")],
  ["music_rhymes", word("songs?|rhymes?|sing[- ]?alongs?|nursery|lullab(?:y|ies)|music(?:al)?|dance")],
  // "count", not "counts": "Every Tree Counts" is about trees.
  ["maths", word("count(?:ing)?|numbers?|maths?|shapes?|patterns?|sorting|measur(?:e|ing)")],
  ["science", word("science|experiments?|space|planets?|moon|sun|stars?|rockets?|astronauts?|mars|rovers?|earth|weather|volcano(?:es)?|magnets?|solar")],
  ["educational", word("alphabet|abc|phonics|letters?|first words|lessons?|body parts|manners|colou?rs")],
  ["general_knowledge", word("animals?|fish|guppy|nature|plants?|trees?|flowers?|ocean|birds?|insects?|butterfl(?:y|ies)|facts?|vehicles?|trucks?|trains?|aquarium|zoo|farm|pets?")],
  ["activities", word("activit(?:y|ies)|play[- ]?along|games?|challenges?|scavenger hunt")],
  ["animated_videos", word("cartoons?|animated|animation")],
];

// When the title names no category, the source's usual one comes before guesses from the description.
const SOURCE_CATEGORY: Record<string, string> = { nasa_images: "science" };

const INTEREST_RULES: Array<[string, RegExp]> = [
  ["animals", word("animals?|dogs?|cats?|lions?|elephants?|birds?|farm|fish|butterfl(?:y|ies)|insects?|giraffes?|flamingos?|ducks?|pigs?")],
  ["space", word("space|planets?|moon|stars?|rockets?|astronauts?|mars|sun")],
  ["numbers", word("count(?:ing)?|numbers?|maths?")],
  ["shapes_colors", word("shapes?|colou?rs?")],
  ["letters", word("alphabet|abc|phonics|letters?")],
  ["music", word("songs?|music|dance|sing")],
  ["stories", word("story|stories|read[- ]?aloud")],
  ["nature", word("nature|plants?|trees?|flowers?|butterfl(?:y|ies)")],
  ["ocean", word("fish|ocean|sea|guppy|aquarium")],
  ["weather", word("weather|rain|clouds?")],
  ["emotions", word("feelings?|emotions?")],
  ["yoga", word("yoga|breath(?:e|ing)|stretch")],
  ["art", word("draw(?:ing)? (?:a|an|the|for|with)|paint(?:ing)?|crafts?")],
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

const matchingCategories = (text: string) => CATEGORY_RULES.filter(([, pattern]) => pattern.test(text)).map(([key]) => key);

/** Primary first: the discovery hint, then what the title says, then the source's usual category, then the description. */
export function suggestCategories(input: RuleInput, hints: DiscoveryHints = {}): string[] {
  const isBook = input.contentType === "STORYBOOK";
  const fromTitle = matchingCategories([input.title, input.tags.join(" ")].join(" \n "));
  const fromDescription = fromTitle.length ? [] : matchingCategories(input.description ?? "");
  const sourceDefault = input.source ? SOURCE_CATEGORY[input.source] : undefined;
  const ordered = [
    ...(isBook ? ["storybooks"] : []),
    ...(hints.category ? [hints.category] : []),
    ...fromTitle,
    ...(sourceDefault ? [sourceDefault] : []),
    ...fromDescription,
  ];
  // Storybooks is only for books; Stories (story videos) says nothing more about a book.
  return [...new Set(ordered)].filter((key) => (isBook ? key !== "stories" : key !== "storybooks")).slice(0, MAX_CATEGORIES);
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

  const categories = suggestCategories(input, hints);
  const category = categories[0] ?? null;
  const interests = [...new Set([...(hints.interests ?? []), ...INTEREST_RULES.filter(([, pattern]) => pattern.test(text)).map(([key]) => key)])];
  const goals = category ? CATEGORY_GOALS[category] : undefined;
  const regulationFromText = word("calm(?:ing)?|sleep|bedtime|relax(?:ing)?|lullaby").test(text) ? ["calm", "relaxation"] : [];

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
      categories,
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
    flaggedCritical: criteria.some((c) => TEXT_CHECKS.find((check) => check.key === c.key)?.critical),
  };
}
