export interface NluCurationResult {
  interests: string[];
  contentMixMode: "surprise_us" | "choose_categories";
  contentMixCategories: string[];
  regulationGoals: string[];
}
