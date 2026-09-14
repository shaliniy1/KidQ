export type ContentMixMode = "surprise_us" | "choose_categories";
export type BreakType = "movement" | "quiet_calm" | "alternate";

// The spec's 6 parent-facing regulation goals map to these fixed engine
// tags (Section 1 Block D) — a stable, spec-given vocabulary, not
// admin-tunable content config like the category list.
export const REGULATION_GOAL_TAGS = [
  "Calm",
  "Emotional Regulation",
  "Focus",
  "Movement",
  "Relaxation",
  "Social Regulation",
] as const;
export type RegulationGoalTag = (typeof REGULATION_GOAL_TAGS)[number];

export const BREAK_TYPES: BreakType[] = ["movement", "quiet_calm", "alternate"];
export const DURATION_OPTIONS = [10, 15, 30, 45, 60, 90] as const;
export const BREAK_INTERVAL_OPTIONS = [10, 15, 20] as const;

export interface DailySchedule {
  enabled: boolean;
  /** 24h "HH:MM" — display only in phase 1, reminder never gates a session (spec Section 11 #27). */
  startTime: string;
  endTime: string;
}

export interface CurationSettings {
  childId: string;
  /** Subset of the config category list (ticket 01) — never validated against a hardcoded list. */
  interests: string[];
  contentMixMode: ContentMixMode;
  /** Only meaningful when contentMixMode is "choose_categories". */
  contentMixCategories: string[];
  /**
   * Empty = no restriction (spec Section 8: "all regulation goals
   * included" is the effective default when nothing's chosen) — mirrors
   * Interests' own "default = none selected" pattern (Section 1 Block A),
   * not a separate all-six-preselected state.
   */
  regulationGoals: RegulationGoalTag[];
  durationDefault: (typeof DURATION_OPTIONS)[number];
  breakInterval: (typeof BREAK_INTERVAL_OPTIONS)[number];
  breakType: BreakType;
  /**
   * Settings (P7) fields — same store as the Hub's curation fields above,
   * per spec ("same field the Hub's Screen-time block edits; changing it
   * in either place updates the one shared value"). Kept per-child, not
   * per-family, for consistency with breakType/breakInterval already
   * being per-child here.
   */
  autoplay: boolean;
  sensoryMode: boolean;
  dailySchedule: DailySchedule;
  updatedAt: string;
}
