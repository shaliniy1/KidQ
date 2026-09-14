export type AgeBand = "0-2" | "2-3" | "3-4" | "4-5" | "5-6";

export interface AgeBandDefaults {
  developmentGoals: string[];
}

export interface ParentExperienceConfig {
  version: number;
  categories: string[];
  contentMixDefault: "surprise_us" | "choose_categories";
  ageBands: AgeBand[];
  ageBandDefaults: Record<AgeBand, AgeBandDefaults>;
}
