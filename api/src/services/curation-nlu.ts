import { getParentExperienceConfig } from "./parent-config";
import { REGULATION_GOAL_TAGS, type RegulationGoalTag } from "../types/curation-settings";
import type { NluCurationResult } from "../types/curation-nlu";

/**
 * Best-effort keyword/synonym matcher (spec Table B #6: "a best-effort
 * mapping", no technology mandated). Deliberately not an LLM call: the
 * output space here is small and closed (the config category list, 6 fixed
 * regulation tags), which keyword matching covers reasonably well without
 * adding an external API dependency, cost, latency, or another
 * "not configured until you supply credentials" state on top of Firebase.
 * Swappable later behind this same function signature if a real NLU/LLM
 * step is wanted.
 */
const REGULATION_KEYWORDS: Record<RegulationGoalTag, string[]> = {
  Calm: ["calm", "calming", "soothe", "soothing", "gentle"],
  "Emotional Regulation": ["feelings", "big feelings", "upset", "tantrum", "emotion", "emotional"],
  Focus: ["focus", "attention", "concentrate", "concentration"],
  Movement: ["energy", "active", "movement", "dance", "run", "burn off"],
  Relaxation: ["bedtime", "before bed", "wind down", "wind-down", "sleep", "night"],
  "Social Regulation": ["share", "sharing", "friends", "play nicely", "social", "others"],
};

/**
 * Extracts whatever it can from free text into the three curation
 * dimensions (Content Category / Interests / Regulation Goal). Anything
 * not matched comes back as the same defaults the Hub itself uses
 * (Surprise-us, no categories, no restriction) — spec Section 8: "falls
 * back to existing defaults... never a new 'please clarify' re-ask flow."
 *
 * Voice can't cleanly separate "this is an Interest" from "this is a
 * Content Category" when both draw on the same category vocabulary in
 * casual speech ("calming animal stories") — a fuzzy problem the spec
 * doesn't fully resolve either. Pragmatic call: a matched category
 * populates both Interests (as a signal of what the parent mentioned) and
 * Content mix (switched to "choose_categories" with that category) — the
 * parent reviews and can change either independently on the Hub afterward.
 */
export async function extractCurationTags(transcript: string): Promise<NluCurationResult> {
  const lower = transcript.toLowerCase();
  const config = await getParentExperienceConfig();

  const matchedCategories = config.categories.filter((category) => {
    // "Music/Rhymes" -> match on "music" or "rhymes"; most others are one word.
    return category
      .toLowerCase()
      .split("/")
      .some((part) => lower.includes(part.trim()));
  });

  const matchedGoals = REGULATION_GOAL_TAGS.filter((tag) =>
    REGULATION_KEYWORDS[tag].some((keyword) => lower.includes(keyword))
  );

  return {
    interests: matchedCategories,
    contentMixMode: matchedCategories.length > 0 ? "choose_categories" : "surprise_us",
    contentMixCategories: matchedCategories,
    regulationGoals: matchedGoals,
  };
}
