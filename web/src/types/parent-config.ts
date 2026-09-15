export type AgeBand = "0-2" | "2-3" | "3-4" | "4-5" | "5-6";

export interface CategoriesResponse {
  categories: string[];
  contentMixDefault: "surprise_us" | "choose_categories";
}

export interface AgeBandDefaultsResponse {
  ageBands: AgeBand[];
  ageBandDefaults: Record<AgeBand, { developmentGoals: string[] }>;
}
