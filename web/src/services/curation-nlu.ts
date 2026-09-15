export interface NluCurationResult {
  interests: string[];
  contentMixMode: "surprise_us" | "choose_categories";
  contentMixCategories: string[];
  regulationGoals: string[];
}

/**
 * There is no real /nlu/curation endpoint yet — voice/guided capture has no
 * backend tag-extraction to call. Returns an empty result rather than
 * fabricating tags, so the Hub screen falls back to its manual fields; the
 * transcript itself is still shown to the parent to review/edit by hand.
 */
export async function extractCurationTags(): Promise<NluCurationResult> {
  return { interests: [], contentMixMode: "surprise_us", contentMixCategories: [], regulationGoals: [] };
}
